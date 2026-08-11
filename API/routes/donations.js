const express = require('express');
const router = express.Router();
const db = require('../db');
const { preferenceClient } = require('../mercadopago');

const SITE_URL = process.env.SITE_URL || 'http://localhost:8080';

/**
 * POST /api/donations
 * Body: { name, email, phone, amount (em reais, ex: 40.00), periodicity: "unica" | "mensal" }
 *
 * Cria o registro da doação como "pending" no Postgres, cria a preferência
 * no Mercado Pago e devolve a URL de checkout (init_point) pro front-end
 * redirecionar o doador.
 */
router.post('/donations', async (req, res) => {
  const { name, email, phone, amount, periodicity } = req.body;

  // validação básica
  if (!name || !email || !amount || !periodicity) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, email, amount, periodicity.' });
  }
  const amountNumber = Number(amount);
  if (!Number.isFinite(amountNumber) || amountNumber < 10) {
    return res.status(400).json({ error: 'O valor da doação deve ser de no mínimo R$ 10,00.' });
  }
  if (!['unica', 'mensal'].includes(periodicity)) {
    return res.status(400).json({ error: 'periodicity deve ser "unica" ou "mensal".' });
  }

  const amountCents = Math.round(amountNumber * 100);

  try {
    // 1. grava a doação como pendente
    const insertResult = await db.query(
      `INSERT INTO donations (donor_name, donor_email, donor_phone, amount_cents, periodicity, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [name, email, phone || null, amountCents, periodicity]
    );
    const donationId = insertResult.rows[0].id;

    // 2. cria a preferência no Mercado Pago
    // Observação: Mercado Pago Checkout Pro nativo não gerencia assinaturas
    // recorrentes por preferência simples — doações "mensais" tipicamente
    // exigem a API de Assinaturas (Preapproval) do Mercado Pago, que tem
    // fluxo próprio. Aqui tratamos o fluxo de doação única; deixamos um
    // apontamento no código de onde entraria a chamada de Preapproval.
    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: `doacao-${donationId}`,
            title:
              periodicity === 'mensal'
                ? 'Apadrinhamento mensal — Instituto Akachi'
                : 'Doação única — Instituto Akachi',
            quantity: 1,
            unit_price: amountNumber,
            currency_id: 'BRL',
          },
        ],
        payer: {
          name,
          email,
        },
        external_reference: String(donationId),
        back_urls: {
          success: `${SITE_URL}/doacao-sucesso.html`,
          failure: `${SITE_URL}/doacao-erro.html`,
          pending: `${SITE_URL}/doacao-pendente.html`,
        },
        auto_return: 'approved',
        notification_url: `${process.env.BACKEND_URL}/api/webhooks/mercadopago`,
      },
    });

    // 3. guarda o id da preferência
    await db.query(`UPDATE donations SET mp_preference_id = $1, updated_at = now() WHERE id = $2`, [
      preference.id,
      donationId,
    ]);

    return res.json({
      donationId,
      checkoutUrl: preference.init_point,
    });
  } catch (err) {
    console.error('Erro ao criar doação/preferência:', err);
    return res.status(500).json({ error: 'Não foi possível iniciar o pagamento. Tente novamente em instantes.' });
  }
});

module.exports = router;
