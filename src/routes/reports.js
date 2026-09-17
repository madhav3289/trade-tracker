const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /reports/summary
// Overall + per-asset P&L. Simplified model: money spent on buys vs.
// money received on sells. Good enough to demonstrate real SQL aggregation;
// note the simplification in your README if asked about it in an interview
// (a fuller model would track cost basis / FIFO per lot).
router.get('/summary', async (req, res) => {
  try {
    const overall = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'buy' THEN quantity * price END), 0) AS total_invested,
         COALESCE(SUM(CASE WHEN type = 'sell' THEN quantity * price END), 0) AS total_returns,
         COUNT(*) AS transaction_count
       FROM transactions
       WHERE user_id = $1`,
      [req.userId]
    );

    const byAsset = await pool.query(
      `SELECT
         asset,
         COALESCE(SUM(CASE WHEN type = 'buy' THEN quantity * price END), 0) AS invested,
         COALESCE(SUM(CASE WHEN type = 'sell' THEN quantity * price END), 0) AS returns,
         COUNT(*) AS transaction_count
       FROM transactions
       WHERE user_id = $1
       GROUP BY asset
       ORDER BY asset`,
      [req.userId]
    );

    const row = overall.rows[0];
    const totalInvested = Number(row.total_invested);
    const totalReturns = Number(row.total_returns);

    res.json({
      total_invested: totalInvested,
      total_returns: totalReturns,
      net_pnl: totalReturns - totalInvested,
      transaction_count: Number(row.transaction_count),
      by_asset: byAsset.rows.map((r) => ({
        asset: r.asset,
        invested: Number(r.invested),
        returns: Number(r.returns),
        net_pnl: Number(r.returns) - Number(r.invested),
        transaction_count: Number(r.transaction_count),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /reports/monthly
// P&L grouped by calendar month — this is the "automation of user reports" piece.
router.get('/monthly', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         date_trunc('month', occurred_at) AS month,
         COALESCE(SUM(CASE WHEN type = 'buy' THEN quantity * price END), 0) AS invested,
         COALESCE(SUM(CASE WHEN type = 'sell' THEN quantity * price END), 0) AS returns,
         COUNT(*) AS transaction_count
       FROM transactions
       WHERE user_id = $1
       GROUP BY month
       ORDER BY month DESC`,
      [req.userId]
    );

    const rows = result.rows.map((r) => ({
      month: r.month,
      invested: Number(r.invested),
      returns: Number(r.returns),
      net_pnl: Number(r.returns) - Number(r.invested),
      transaction_count: Number(r.transaction_count),
    }));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
