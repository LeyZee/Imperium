const express = require('express');
const router = express.Router();

// Exemple de route admin
router.get('/', (req, res) => {
  res.json({ message: 'Admin API is working!' });
});

module.exports = router; 