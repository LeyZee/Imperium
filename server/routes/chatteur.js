const express = require('express');
const router = express.Router();

// Exemple de route chatteur
router.get('/', (req, res) => {
  res.json({ message: 'Chatteur API is working!' });
});

module.exports = router; 