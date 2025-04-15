const express = require('express');
const router = express.Router();

// Webhook Clerk (exemple minimal)
router.post('/webhook', (req, res) => {
  // À compléter avec la logique d'attribution de rôle
  res.json({ received: true });
});

module.exports = router; 