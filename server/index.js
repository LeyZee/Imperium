const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// --- ROUTES DE TEST ---
app.get('/', (req, res) => {
  res.send('Imperium backend is running!');
});

// --- ROUTES API ---
app.use('/admin', require('./routes/admin'));
app.use('/chatteur', require('./routes/chatteur'));
app.use('/api/clerk', require('./routes/clerk'));

// --- ERREUR 404 ---
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Imperium backend running on port ${PORT}`);
}); 