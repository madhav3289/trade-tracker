const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// Every route below requires a valid JWT, and every query is scoped
// to req.userId — this is what prevents user A from reading user B's data.
router.use(requireAuth);

// POST /transactions
router.post('/', async (req, res) => {
  const { type, asset, quantity, price, occurred_at } = req.body;

  if (!type || !['buy', 'sell'].includes(type)) {
    return res.status(400).json({ error: 'type must be "buy" or "sell"' });
  }
  if (!asset || quantity == null || price == null) {
    return res.status(400).json({ error: 'asset, quantity, and price are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, asset, quantity, price, occurred_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))
       RETURNING *`,
      [req.userId, type, asset, quantity, price, occurred_at || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /transactions?asset=BTC&limit=50&offset=0
router.get('/', async (req, res) => {
  const { asset } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    let query = 'SELECT * FROM transactions WHERE user_id = $1';
    const params = [req.userId];

    if (asset) {
      params.push(asset);
      query += ` AND asset = $${params.length}`;
    }

    query += ' ORDER BY occurred_at DESC';
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /transactions/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'transaction not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// PUT /transactions/:id
router.put('/:id', async (req, res) => {
  const { type, asset, quantity, price, occurred_at } = req.body;

  try {
    const result = await pool.query(
      `UPDATE transactions
       SET type = COALESCE($1, type),
           asset = COALESCE($2, asset),
           quantity = COALESCE($3, quantity),
           price = COALESCE($4, price),
           occurred_at = COALESCE($5, occurred_at)
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [type, asset, quantity, price, occurred_at, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'transaction not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// DELETE /transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'transaction not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
