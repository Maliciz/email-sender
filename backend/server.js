import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';
import fs from 'fs';
import readline from 'readline';
import cors from 'cors';
import { query } from './db.js';

// Load environment variables
dotenv.config();

// Configure SendGrid API Key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Global lock variable to prevent parallel mailing processes
let isMailing = false;

// Ensure table exists on server start
async function initDb() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        status VARCHAR(50) DEFAULT 'pending'
      );
    `);
  } catch (err) {
    console.error('Error creating contacts table:', err);
  }
}
initDb();

/**
 * 2. Upload Contacts (POST /upload)
 * Accepts file upload (.txt or .csv), extracts email addresses,
 * and inserts them into database table using ON CONFLICT DO NOTHING.
 */
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
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

      // Handle simple CSV commas by splitting
      if (trimmed.includes(',')) {
        const parts = trimmed.split(',');
        for (const part of parts) {
          const clean = part.trim().replace(/^["']|["']$/g, '');
          if (clean && clean.includes('@')) {
            emails.push(clean);
          }
        }
      } else {
        const clean = trimmed.replace(/^["']|["']$/g, '');
        if (clean && clean.includes('@')) {
          emails.push(clean);
        }
      }
    }

    // Clean up temporary upload file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete upload file:', err);
    });

    let insertedCount = 0;
    for (const email of emails) {
      const result = await query(
        'INSERT INTO contacts (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
        [email]
      );
      if (result && result.rowCount) {
        insertedCount += result.rowCount;
      }
    }

    return res.status(200).json({
      message: 'Contacts processed successfully',
      insertedCount,
      count: insertedCount
    });
  } catch (err) {
    console.error('Error processing upload:', err);
    return res.status(500).json({ error: 'Internal server error during contact upload' });
  }
});

/**
 * 4. Background Logic processMailing(subject, html)
 * Batch processes pending contacts recursively with rate-limiting delay.
 */
async function processMailing(subject, html) {
  try {
    const { rows } = await query(
      "SELECT email FROM contacts WHERE status = 'pending' LIMIT 50"
    );

    if (!rows || rows.length === 0) {
      console.log('Mailing completed: No pending contacts remain.');
      isMailing = false;
      return;
    }

    for (const contact of rows) {
      const msg = {
        to: contact.email,
        from: 'hello@serrvvice.com',
        subject,
        html
      };

      try {
        await sgMail.send(msg);
        await query(
          "UPDATE contacts SET status = 'sent' WHERE email = $1",
          [contact.email]
        );
      } catch (err) {
        console.error(`SendGrid failed to send email to ${contact.email}:`, err.message || err);
        await query(
          "UPDATE contacts SET status = 'error' WHERE email = $1",
          [contact.email]
        );
      }

      // CRITICAL: 1-second delay between emails to respect rate limits
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Recursively process the next batch
    await processMailing(subject, html);
  } catch (err) {
    console.error('Error in processMailing background task:', err);
    isMailing = false;
  }
}

/**
 * 3. Start Background Mailing (POST /start-mailing)
 * Accepts subject and html body, prevents parallel mailing runs,
 * responds immediately, and triggers background mailing.
 */
app.post('/start-mailing', (req, res) => {
  try {
    const { subject, html } = req.body;

    if (isMailing) {
      return res.status(400).json({ message: 'Mailing is already in progress' });
    }

    if (!subject || !html) {
      return res.status(400).json({ error: 'subject and html fields are required' });
    }

    isMailing = true;

    // Respond immediately
    res.status(200).json({ message: 'Mailing started in background' });

    // Trigger asynchronous background worker
    processMailing(subject, html).catch((err) => {
      console.error('Unhandled background process exception:', err);
      isMailing = false;
    });
  } catch (err) {
    console.error('Error starting mailing:', err);
    isMailing = false;
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start mailing' });
    }
  }
});

/**
 * 5. Track Progress (GET /progress)
 * Aggregates counts by status and returns current state.
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
  } catch (err) {
    console.error('Error retrieving mailing progress:', err);
    return res.status(500).json({ error: 'Failed to fetch mailing progress' });
  }
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
