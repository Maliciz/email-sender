import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';
import { query } from './db.js';

// Load environment variables
dotenv.config();

// Configure SendGrid API Key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Root health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Email Sender API is running' });
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup
const upload = multer({ dest: uploadsDir });

// Global Lock & State
let isMailing = false;
let currentSenderEmail = process.env.DEFAULT_SENDER_EMAIL || process.env.SENDER_EMAIL || '';
let sseClients = [];
let recentLogs = [];

// Initialize database tables
async function initDatabaseTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'pending'
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS senders (
        id SERIAL PRIMARY KEY,
        email_address VARCHAR(255) UNIQUE NOT NULL,
        domain_name VARCHAR(255)
      );
    `);
    console.log('Database tables verified and initialized.');
  } catch (err) {
    console.error('Error initializing database tables:', err);
  }
}
initDatabaseTables();

// Helper to log and broadcast updates
function addLog(message) {
  const logEntry = {
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    message
  };
  recentLogs.unshift(logEntry);
  if (recentLogs.length > 100) recentLogs.pop();
  broadcastSSEStatus();
}

// Helper to fetch statistics for SSE & UI
async function getProgressStats() {
  try {
    if (!currentSenderEmail) {
      const senderRes = await query('SELECT email_address FROM senders ORDER BY id DESC LIMIT 1');
      if (senderRes && senderRes.rows && senderRes.rows.length > 0) {
        currentSenderEmail = senderRes.rows[0].email_address;
      }
    }

    const { rows } = await query(
      'SELECT status, COUNT(*) as count FROM contacts GROUP BY status'
    );

    const counts = { pending: 0, sent: 0, error: 0 };
    let total = 0;

    if (rows && rows.length > 0) {
      rows.forEach((row) => {
        const countNum = parseInt(row.count, 10) || 0;
        if (counts.hasOwnProperty(row.status)) {
          counts[row.status] = countNum;
        }
        total += countNum;
      });
    }

    return {
      isMailing,
      status: isMailing ? 'sending' : 'idle',
      currentSenderEmail,
      total,
      sent: counts.sent,
      remaining: counts.pending,
      errors: counts.error,
      pending: counts.pending,
      error: counts.error,
      logs: recentLogs
    };
  } catch (err) {
    return {
      isMailing,
      status: isMailing ? 'sending' : 'idle',
      currentSenderEmail,
      total: 0,
      sent: 0,
      remaining: 0,
      errors: 0,
      pending: 0,
      error: 0,
      logs: recentLogs
    };
  }
}

// Broadcast stats to connected SSE clients
async function broadcastSSEStatus() {
  if (sseClients.length === 0) return;
  const stats = await getProgressStats();
  const data = `data: ${JSON.stringify(stats)}\n\n`;
  sseClients.forEach((client) => client.write(data));
}

// Periodic SSE ping
setInterval(() => {
  broadcastSSEStatus();
}, 3000);

/**
 * GET /status/events - SSE Real-time Status Stream
 */
app.get('/status/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const stats = await getProgressStats();
  res.write(`data: ${JSON.stringify(stats)}\n\n`);

  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter((client) => client !== res);
  });
});

/**
 * GET /senders - Fetch authenticated sender emails
 */
app.get('/senders', async (req, res) => {
  try {
    const { rows } = await query('SELECT id, email_address, domain_name FROM senders ORDER BY id DESC');
    return res.status(200).json({
      success: true,
      senders: rows
    });
  } catch (error) {
    console.error('Error fetching senders:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch senders' });
  }
});

/**
 * POST /senders - Add new sender domain email
 */
app.post('/senders', async (req, res) => {
  try {
    const { email_address, domain_name } = req.body;
    if (!email_address || !email_address.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email address is required' });
    }

    const emailTrimmed = email_address.trim();
    const computedDomain = domain_name ? domain_name.trim() : emailTrimmed.split('@')[1];

    const { rows } = await query(
      'INSERT INTO senders (email_address, domain_name) VALUES ($1, $2) ON CONFLICT (email_address) DO NOTHING RETURNING *',
      [emailTrimmed, computedDomain]
    );

    addLog(`[System] Added sender domain: ${emailTrimmed}`);

    return res.status(200).json({
      success: true,
      message: 'Sender added successfully',
      sender: rows[0] || { email_address: emailTrimmed, domain_name: computedDomain }
    });
  } catch (error) {
    console.error('Error adding sender:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to add sender' });
  }
});

/**
 * DELETE /senders/:id - Delete sender domain
 */
app.delete('/senders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM senders WHERE id = $1', [id]);
    return res.status(200).json({ success: true, message: 'Sender deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /contacts - Fetch database contacts
 */
app.get('/contacts', async (req, res) => {
  try {
    const { rows } = await query('SELECT id, email, status FROM contacts ORDER BY id DESC');
    return res.status(200).json({
      success: true,
      contacts: rows
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch contacts' });
  }
});

/**
 * Shared Contact Ingestion Logic
 */
const processContactInsertion = async (emails, res) => {
  try {
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid emails provided' });
    }

    addLog(`[System] Deploying batch of ${emails.length} contacts...`);
    let insertedCount = 0;

    for (const rawEmail of emails) {
      const email = typeof rawEmail === 'string' ? rawEmail.trim() : '';
      if (!email || !email.includes('@')) continue;

      const dbRes = await query(
        'INSERT INTO contacts (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
        [email]
      );
      if (dbRes && dbRes.rowCount) {
        insertedCount += dbRes.rowCount;
      }
    }

    addLog(`[System] Successfully inserted ${insertedCount} contacts into database.`);
    broadcastSSEStatus();

    return res.status(200).json({
      success: true,
      message: 'Contacts uploaded successfully',
      insertedCount,
      count: insertedCount
    });
  } catch (error) {
    console.error('Error inserting contacts:', error);
    addLog(`[Error] Insert failed: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to insert contacts into database'
    });
  }
};

/**
 * POST /deploy-contacts - Bulk deploy from UI
 */
app.post('/deploy-contacts', async (req, res) => {
  const { emails } = req.body;
  return processContactInsertion(emails, res);
});

/**
 * 2. Upload Contacts (POST /upload)
 * Accepts file upload (.txt or .csv) via Multer or raw emails array,
 * extracts email addresses, trims spaces, ignores empty lines,
 * and inserts them using ON CONFLICT DO NOTHING.
 */
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (req.body && req.body.emails) {
      let emailsList = req.body.emails;
      if (typeof emailsList === 'string') {
        try { emailsList = JSON.parse(emailsList); } catch { emailsList = [emailsList]; }
      }
      return processContactInsertion(emailsList, res);
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file or emails provided' });
    }

    const filePath = req.file.path;
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const emails = [];

    for await (const line of rl) {
      let trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.toLowerCase() === 'email') continue;

      if (trimmed.includes(',')) {
        const parts = trimmed.split(',');
        for (const part of parts) {
          const cleanPart = part.trim().replace(/^["']|["']$/g, '');
          if (cleanPart.includes('@')) {
            emails.push(cleanPart);
          }
        }
      } else {
        const cleanPart = trimmed.replace(/^["']|["']$/g, '');
        if (cleanPart && cleanPart.includes('@')) {
          emails.push(cleanPart);
        }
      }
    }

    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete upload file:', err);
    });

    return processContactInsertion(emails, res);
  } catch (error) {
    console.error('Error in POST /upload:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error processing contact upload'
    });
  }
});

/**
 * 4. Background Logic processMailing(subject, html, senderEmail)
 * Fetches pending contacts in batches of 50, sends email via SendGrid,
 * updates DB status ('sent' or 'error'), enforces 1s delay, and calls itself recursively.
 */
async function processMailing(subject, html, senderEmail) {
  try {
    const { rows } = await query(
      "SELECT email FROM contacts WHERE status = 'pending' LIMIT 50"
    );

    if (!rows || rows.length === 0) {
      addLog('[System] Mailing completed. No pending contacts remaining.');
      isMailing = false;
      broadcastSSEStatus();
      return;
    }

    const fromAddress = senderEmail || currentSenderEmail || process.env.DEFAULT_SENDER_EMAIL || process.env.SENDER_EMAIL;

    for (const contact of rows) {
      const email = contact.email;
      const msg = {
        to: email,
        from: fromAddress,
        subject,
        html
      };

      try {
        await sgMail.send(msg);
        await query(
          "UPDATE contacts SET status = 'sent' WHERE email = $1",
          [email]
        );
        addLog(`[Sent] Email delivered to ${email}`);
      } catch (err) {
        console.error(`SendGrid error for ${email}:`, err.message || err);
        await query(
          "UPDATE contacts SET status = 'error' WHERE email = $1",
          [email]
        );
        addLog(`[Error] Failed to send email to ${email}: ${err.message || 'SendGrid Error'}`);
      }

      broadcastSSEStatus();

      // CRITICAL: 1-second rate-limiting delay between emails
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Process next batch recursively
    await processMailing(subject, html, fromAddress);
  } catch (error) {
    console.error('Error in processMailing background worker:', error);
    addLog(`[Error] Background process error: ${error.message}`);
    isMailing = false;
    broadcastSSEStatus();
  }
}

/**
 * 3. Start Background Mailing (POST /start-mailing)
 * Accepts subject and html/body from request body, checks lock,
 * responds instantly with 200 OK, and calls processMailing without blocking.
 */
app.post('/start-mailing', (req, res) => {
  try {
    const { subject, html, body, senderEmail } = req.body;

    if (isMailing) {
      return res.status(400).json({
        success: false,
        message: 'Mailing is already in progress'
      });
    }

    const campaignSubject = subject || 'Campaign Notification';
    const campaignHtml = html || body || '<p>Default Campaign Content</p>';
    if (senderEmail) {
      currentSenderEmail = senderEmail;
    }

    isMailing = true;
    addLog(`[System] Launching campaign using sender: ${currentSenderEmail}...`);

    // Respond instantly
    res.status(200).json({ message: 'Mailing started in background' });

    // Fire and forget background worker
    processMailing(campaignSubject, campaignHtml, currentSenderEmail).catch((err) => {
      console.error('Unhandled processMailing error:', err);
      isMailing = false;
      addLog(`[Error] Process failed: ${err.message}`);
      broadcastSSEStatus();
    });
  } catch (error) {
    console.error('Error in POST /start-mailing:', error);
    isMailing = false;
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

/**
 * 5. Track Progress (GET /progress)
 * Returns status aggregation query and current boolean isMailing state.
 */
app.get('/progress', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT status, COUNT(*) as count FROM contacts GROUP BY status'
    );

    const counts = { pending: 0, sent: 0, error: 0 };
    if (rows && rows.length > 0) {
      rows.forEach((row) => {
        const countNum = parseInt(row.count, 10) || 0;
        if (counts.hasOwnProperty(row.status)) {
          counts[row.status] = countNum;
        }
      });
    }

    return res.status(200).json({
      isMailing,
      pending: counts.pending,
      sent: counts.sent,
      error: counts.error
    });
  } catch (error) {
    console.error('Error during GET /progress:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve progress'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
