// Seeds one demo user + ~25 transactions so the report endpoints have something meaningful to aggregate. 
// Run with: node db/seed.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/db');

const ASSETS = ['BTC', 'ETH', 'AAPL', 'TSLA'];

function randomDateWithinLastMonths(months) {
  const now = Date.now();
  const past = now - months * 30 * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const email = 'demo@example.com';
    const passwordHash = await bcrypt.hash('demo1234', 10);

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
    } else {
      const userResult = await client.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, passwordHash]
      );
      userId = userResult.rows[0].id;
    }

    const insertText = `
      INSERT INTO transactions (user_id, type, asset, quantity, price, occurred_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    for (let i = 0; i < 25; i++) {
      const asset = ASSETS[Math.floor(Math.random() * ASSETS.length)];
      const type = Math.random() > 0.4 ? 'buy' : 'sell';
      const quantity = +(Math.random() * 5 + 0.1).toFixed(4);
      const price = +(Math.random() * 500 + 50).toFixed(2);
      const occurredAt = randomDateWithinLastMonths(4);

      await client.query(insertText, [userId, type, asset, quantity, price, occurredAt]);
    }

    await client.query('COMMIT');
    console.log(`Seeded user "${email}" (password: demo1234) with 25 transactions.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
