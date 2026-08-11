const express = require('express');
const router = express.Router();
const db = require('../db');
const { paymentClient } = require('../mercadopago');

/**
 * POST /api/webhooks/mercadopago
 *
 * O Mercado Pago chama essa URL sempre que o status de um pagamento muda.
 * Ele manda só o ID — por segurança, buscamos os detalhes reais na API do
 * MP em vez de confiar no corpo da notificação.
 * Doc oficial: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/notifications/webhooks
 */
router.post('/webhooks/mercadopago', async (req, res) => {
  const { type, data } = req.body;

  // loga bruto pra auditoria/debug, mesmo que não seja um evento que tratamos
  try {
    await db.query(
      `INSERT INTO mp_webhook_events (event_type, mp_payment_id, raw_payload) VALUES ($1, $2, $3)`,
      [type || null, data && data.id ? String(data.id) : null, req.body]
    );
  } catch (logErr) {
    console.error('Falha ao logar webhook (seguindo mesmo assim):', logErr);
  }

  // respondemos 200 rápido pro Mercado Pago não ficar reenviando,
  // e processamos de forma best-effort
  res.sendStatus(200);

  if (type !== 'payment' || !data || !data.id) return;

  try {
    const payment = await paymentClient.get({ id: data.id });

    const donationId = payment.external_reference;
    const status = payment.status; // approved | pending | rejected | cancelled | refunded ...

    if (!donationId) {
      console.warn('Webhook de pagamento sem external_reference:', payment.id);
      return;
    }

    await db.query(
      `UPDATE donations
       SET status = $1, mp_payment_id = $2, payment_method = $3, updated_at = now()
       WHERE id = $4`,
      [status, String(payment.id), payment.payment_method_id || null, donationId]
    );

    console.log(`Doação #${donationId} atualizada para status "${status}" (pagamento ${payment.id})`);
  } catch (err) {
    console.error('Erro ao processar webhook de pagamento:', err);
  }
});

module.exports = router;
