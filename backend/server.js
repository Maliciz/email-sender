import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csvParser from 'csv-parser';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.txt') {
      cb(null, 'contacts.txt');
    } else {
      cb(null, 'contacts.csv');
    }
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.txt') {
      cb(null, true);
    } else {
      cb(new Error('Only .csv and .txt files are allowed'), false);
    }
  }
});

// State Variables
let status = 'idle'; // 'idle', 'sending', 'paused', 'completed'
let totalContacts = 0;
let sentCount = 0;
let errorCount = 0;
let remainingCount = 0;
let recentLogs = [];
let sentEmails = new Set();
let emailBuffer = [];
let isProcessingBatch = false;
let activeStream = null;
let activeParser = null;
let currentSubject = '';
let currentBody = '';

// Load sent emails cache from sent.txt
async function loadSentEmails() {
  sentEmails.clear();
  const sentFilePath = path.join(__dirname, 'sent.txt');
  if (!fs.existsSync(sentFilePath)) {
    sentCount = 0;
    return;
  }

  const fileStream = fs.createReadStream(sentFilePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const email = line.trim();
    if (email) {
      sentEmails.add(email);
    }
  }
  sentCount = sentEmails.size;
  console.log(`Initialized Set: Loaded ${sentEmails.size} sent emails.`);
}

// Count contacts in uploaded CSV file
async function countCsvContacts(filePath) {
  return new Promise((resolve, reject) => {
    let count = 0;
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        const email = row.email || row.Email || row[Object.keys(row)[0]];
        if (email && email.includes('@')) {
          count++;
        }
      })
      .on('end', () => {
        resolve(count);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

// Convert TXT file (one email per line) to CSV format
async function convertTxtToCsv(txtFilePath, csvFilePath) {
  const writeStream = fs.createWriteStream(csvFilePath);
  const readStream = fs.createReadStream(txtFilePath);
  const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity
  });

  // Write header first
  await new Promise((resolve, reject) => {
    writeStream.write('email\n', 'utf8', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  for await (const line of rl) {
    const cleanEmail = line.trim();
    if (cleanEmail) {
      const canWrite = writeStream.write(`${cleanEmail}\n`, 'utf8');
      if (!canWrite) {
        await new Promise(resolve => writeStream.once('drain', resolve));
      }
    }
  }

  await new Promise((resolve) => {
    writeStream.end(resolve);
  });
}

function addLog(message) {
  const logEntry = {
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    message
  };
  recentLogs.unshift(logEntry);
  if (recentLogs.length > 100) {
    recentLogs.pop();
  }
  broadcastStatus();
}

// Server Sent Events (SSE) state broadcasting
let clients = [];
function broadcastStatus() {
  const stats = {
    status,
    total: totalContacts,
    sent: sentCount,
    remaining: remainingCount,
    errors: errorCount,
    logs: recentLogs
  };
  const data = `data: ${JSON.stringify(stats)}\n\n`;
  clients.forEach(client => client.write(data));
}

// Batch sending function using Axios
async function sendBatch(emails, subject, body) {
  const apiUrl = process.env.EMAIL_API_URL || `http://localhost:${PORT}/api/mock-send`;
  const apiKey = process.env.EMAIL_API_KEY || 'mock-key';

  try {
    const response = await axios.post(apiUrl, {
      emails,
      subject,
      body
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const result = response.data;
    const successfulEmails = result.successfulEmails || emails;
    const errorsThisBatch = result.errorCount || 0;

    if (successfulEmails.length > 0) {
      // Append to file
      const sentFilePath = path.join(__dirname, 'sent.txt');
      await fs.promises.appendFile(sentFilePath, successfulEmails.join('\n') + '\n');
      
      // Update local set
      successfulEmails.forEach(email => sentEmails.add(email));
    }

    sentCount = sentEmails.size;
    errorCount += errorsThisBatch;
    remainingCount = Math.max(0, totalContacts - sentCount);

    addLog(`[Batch Success] Dispatched ${successfulEmails.length} emails. Failures: ${errorsThisBatch}`);
  } catch (error) {
    console.error('Batch delivery error:', error.message);
    errorCount += emails.length;
    remainingCount = Math.max(0, totalContacts - sentCount);
    addLog(`[Batch Error] Network/API fail for ${emails.length} addresses. ${error.message}`);
  }
}

// Core streaming engine
function runEmailSender() {
  const csvPath = path.join(uploadsDir, 'contacts.csv');
  if (!fs.existsSync(csvPath)) {
    status = 'idle';
    addLog('[Error] contacts.csv not found. Please upload first.');
    return;
  }

  addLog('[System] Initializing stream parser...');
  
  activeStream = fs.createReadStream(csvPath);
  activeParser = activeStream.pipe(csvParser());

  activeParser.on('data', (row) => {
    const email = row.email || row.Email || row[Object.keys(row)[0]];
    if (!email || !email.includes('@')) return;

    const cleanEmail = email.trim();
    if (sentEmails.has(cleanEmail)) return;

    emailBuffer.push(cleanEmail);

    if (emailBuffer.length >= 1000 && !isProcessingBatch) {
      isProcessingBatch = true;
      
      // Pause streaming immediately
      activeParser.pause();
      activeStream.pause();

      processActiveBatch();
    }
  });

  activeParser.on('end', async () => {
    // Process remaining
    if (emailBuffer.length > 0 && status === 'sending') {
      isProcessingBatch = true;
      const batch = [...emailBuffer];
      emailBuffer = [];
      await sendBatch(batch, currentSubject, currentBody);
      isProcessingBatch = false;
    }
    
    if (status === 'sending') {
      status = 'completed';
      addLog('[System] Send process completed.');
      broadcastStatus();
    }
  });

  activeParser.on('error', (err) => {
    addLog(`[Error] CSV parsing error: ${err.message}`);
    status = 'idle';
    broadcastStatus();
  });
}

async function processActiveBatch() {
  if (status !== 'sending') {
    isProcessingBatch = false;
    return;
  }

  const batch = emailBuffer.slice(0, 1000);
  emailBuffer = emailBuffer.slice(1000);

  addLog(`[Sending] Dispatching batch of ${batch.length} emails...`);
  await sendBatch(batch, currentSubject, currentBody);

  // Rate Limiting Pause
  await new Promise(resolve => setTimeout(resolve, 1000));

  isProcessingBatch = false;

  if (status === 'paused') {
    addLog('[System] Stream safely paused. Current batch finished.');
    broadcastStatus();
  } else if (status === 'sending') {
    // Resume Stream
    activeParser.resume();
    activeStream.resume();

    // Check if buffer has accumulated overflow during pause
    if (emailBuffer.length >= 1000) {
      isProcessingBatch = true;
      activeParser.pause();
      activeStream.pause();
      processActiveBatch();
    }
  }
}

// API Routes

// POST /upload - upload contacts.csv or contacts.txt
app.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      addLog(`[System Error] File upload failed: ${err.message}`);
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const csvPath = path.join(uploadsDir, 'contacts.csv');

    if (ext === '.txt') {
      addLog('[System] TXT file detected. Converting to CSV...');
      await convertTxtToCsv(req.file.path, csvPath);
      // Clean up temporary TXT file
      try {
        await fs.promises.unlink(req.file.path);
      } catch (unlinkErr) {
        console.error('Failed to unlink temporary txt file:', unlinkErr);
      }
      addLog('[System] Conversion completed. CSV generated.');
    }

    addLog('[System] Parsing and verifying contact counts...');
    const count = await countCsvContacts(csvPath);
    totalContacts = count;
    remainingCount = Math.max(0, totalContacts - sentCount);

    addLog(`[System] Contacts successfully loaded. Found ${totalContacts} valid contact emails.`);
    res.json({ success: true, count });
  } catch (error) {
    addLog(`[System Error] Upload process failed: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /start - starts the streaming and mailing process
app.post('/start', (req, res) => {
  const { subject, body } = req.body;
  if (!subject || !body) {
    return res.status(400).json({ success: false, error: 'Subject and Body are required' });
  }

  if (status === 'sending') {
    return res.status(400).json({ success: false, error: 'Process is already running' });
  }

  const csvPath = path.join(uploadsDir, 'contacts.csv');
  if (!fs.existsSync(csvPath)) {
    return res.status(400).json({ success: false, error: 'Please upload contacts.csv first' });
  }

  currentSubject = subject;
  currentBody = body;
  status = 'sending';
  addLog('[System] Start signal received. Mailing initiated...');
  
  runEmailSender();
  res.json({ success: true, status });
});

// POST /pause - pauses the mailing
app.post('/pause', (req, res) => {
  if (status !== 'sending') {
    return res.status(400).json({ success: false, error: 'Sender is not running' });
  }

  status = 'paused';
  addLog('[System] Pause signal received. Completing current batch...');
  res.json({ success: true, status });
});

// POST /reset - clears sent progress
app.post('/reset', async (req, res) => {
  status = 'idle';
  totalContacts = 0;
  sentCount = 0;
  errorCount = 0;
  remainingCount = 0;
  recentLogs = [];
  emailBuffer = [];
  sentEmails.clear();

  const sentFilePath = path.join(__dirname, 'sent.txt');
  if (fs.existsSync(sentFilePath)) {
    await fs.promises.unlink(sentFilePath);
  }
  
  const csvPath = path.join(uploadsDir, 'contacts.csv');
  if (fs.existsSync(csvPath)) {
    await fs.promises.unlink(csvPath);
  }
  const txtPath = path.join(uploadsDir, 'contacts.txt');
  if (fs.existsSync(txtPath)) {
    await fs.promises.unlink(txtPath);
  }

  addLog('[System] Sent progress and upload cache completely reset.');
  res.json({ success: true });
});

// GET /status - returns statistics for the frontend
app.get('/status', (req, res) => {
  res.json({
    status,
    total: totalContacts,
    sent: sentCount,
    remaining: remainingCount,
    errors: errorCount
  });
});

// GET /status/events - SSE endpoint
app.get('/status/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial data immediately
  res.write(`data: ${JSON.stringify({
    status,
    total: totalContacts,
    sent: sentCount,
    remaining: remainingCount,
    errors: errorCount,
    logs: recentLogs
  })}\n\n`);

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

// POST /api/mock-send - internal mock endpoint
app.post('/api/mock-send', (req, res) => {
  const { emails } = req.body;
  
  setTimeout(() => {
    const successfulEmails = [];
    let errorCountThisBatch = 0;

    emails.forEach(email => {
      // Simulate minor failure rate (e.g. 0.3%)
      if (Math.random() < 0.003) {
        errorCountThisBatch++;
      } else {
        successfulEmails.push(email);
      }
    });

    res.json({
      success: true,
      successfulEmails,
      errorCount: errorCountThisBatch
    });
  }, 100);
});

// Initialize on startup
loadSentEmails().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
