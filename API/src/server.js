require('dotenv').config();
const express = require('express');
const cors = require('cors');

const donationsRouter = require('./routes/donations');
const webhooksRouter = require('./routes/webhooks');

const app = express();

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', donationsRouter);
app.use('/api', webhooksRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor de doações do Akachi rodando na porta ${PORT}`);
});
