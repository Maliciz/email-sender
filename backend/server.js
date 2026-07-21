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

dotenv.config();

// Configure SendGrid API Key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer file upload setup
const upload = multer({ dest: uploadsDir });

// Global state variable safeguard
let isMailing = false;

/**
 * GET /contacts
 * Returns all contacts from PostgreSQL database.
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
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch contacts'
    });
  }
});

/**
 * 1. Upload & Deploy Contacts (POST /upload & POST /deploy-contacts)
 * Accepts either:
 *  - JSON body { emails: ["a@b.com", ...] }
 *  - File upload via multer (.txt or .csv)
 * Inserts emails into contacts table using INSERT ... ON CONFLICT (email) DO NOTHING.
 * Returns 200 OK with count of inserted contacts.
 */
const handleDeployContacts = async (emails, res) => {
  try {
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid emails provided' });
    }

    let insertedCount = 0;
    for (const rawEmail of emails) {
      const email = typeof rawEmail === 'string' ? rawEmail.trim() : '';
      if (!email || !email.includes('@')) continue;

      const dbRes = await query(
        'INSERT INTO contacts (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
        [email]
      );
      if (dbRes && dbRes.rowCount > 0) {
        insertedCount += dbRes.rowCount;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Contacts deployed successfully',
      insertedCount,
      count: insertedCount
    });
  } catch (error) {
    console.error('Error deploying contacts:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to insert contacts into database'
    });
  }
};

app.post('/deploy-contacts', async (req, res) => {
  const { emails } = req.body;
  return handleDeployContacts(emails, res);
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    // If request contains JSON emails array
    if (req.body && req.body.emails) {
      let emailsList = req.body.emails;
      if (typeof emailsList === 'string') {
        try {
          emailsList = JSON.parse(emailsList);
        } catch {
          emailsList = [emailsList];
        }
      }
      return handleDeployContacts(emailsList, res);
    }

    // Otherwise handle file upload
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
            trimmed = cleanPart;
            break;
          }
        }
      }

      trimmed = trimmed.replace(/^["']|["']$/g, '');
      if (trimmed && trimmed.includes('@')) {
        emails.push(trimmed);
      }
    }

    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete temporary upload file:', err);
    });

    return handleDeployContacts(emails, res);
  } catch (error) {
    console.error('Error during POST /upload:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error processing contact upload'
    });
  }
});

/**
 * 3. Background Logic processMailing()
 * Fetches pending contacts from DB in batches of 50.
 * Iterates using a for...of loop, sends email via SendGrid, updates DB status to 'sent' or 'error'.
 * Includes a mandatory 1-second delay between emails to avoid SendGrid rate limits.
 * Recursively calls itself until no pending contacts remain.
 */
async function processMailing() {
  try {
    const { rows } = await query(
      "SELECT email FROM contacts WHERE status = 'pending' LIMIT 50"
    );

    if (!rows || rows.length === 0) {
      console.log('Mailing complete. No pending contacts found.');
      isMailing = false;
      return;
    }

    for (const row of rows) {
      const email = row.email;

      try {
        const msg = {
          to: email,
          from: process.env.FROM_EMAIL || 'no-reply@example.com',
          subject: process.env.EMAIL_SUBJECT || 'Mass Email Notification',
          text: process.env.EMAIL_BODY || 'Hello from our service!',
          html: process.env.EMAIL_HTML || '<p>Hello from our service!</p>'
        };

        await sgMail.send(msg);

        await query(
          "UPDATE contacts SET status = 'sent' WHERE email = $1",
          [email]
        );
      } catch (err) {
        console.error(`SendGrid error for ${email}:`, err.message || err);

        await query(
          "UPDATE contacts SET status = 'error' WHERE email = $1",
          [email]
        );
      }

      // CRITICAL: 1-second delay between sending each email
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Recursively process next batch
    await processMailing();
  } catch (error) {
    console.error('Error in processMailing background worker:', error);
    isMailing = false;
  }
}

/**
 * 2. Start Background Mailing (POST /start-mailing)
 */
app.post('/start-mailing', (req, res) => {
  try {
    if (isMailing) {
      return res.status(400).json({
        success: false,
        message: 'Mailing is already in progress'
      });
    }

    isMailing = true;

    res.status(200).json({ message: 'Mailing started in background' });

    processMailing().catch((err) => {
      console.error('Unhandled error in processMailing:', err);
      isMailing = false;
    });
  } catch (error) {
    console.error('Error during POST /start-mailing:', error);
    isMailing = false;
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

/**
 * 4. Track Progress (GET /progress)
 */
app.get('/progress', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT status, COUNT(*) as count FROM contacts GROUP BY status'
    );

    const counts = {
      pending: 0,
      sent: 0,
      error: 0
    };

    if (rows && rows.length > 0) {
      rows.forEach((row) => {
        const countNum = parseInt(row.count, 10) || 0;
        counts[row.status] = countNum;
      });
    }

    return res.status(200).json({
      isMailing,
      pending: counts.pending,
      sent: counts.sent,
      error: counts.error,
      counts
    });
  } catch (error) {
    console.error('Error during GET /progress:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve progress'
    });
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
