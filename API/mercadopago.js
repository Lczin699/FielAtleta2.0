const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

if (!process.env.MP_ACCESS_TOKEN) {
  console.warn('[aviso] MP_ACCESS_TOKEN não definido — as chamadas ao Mercado Pago vão falhar.');
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const preferenceClient = new Preference(client);
const paymentClient = new Payment(client);

module.exports = { client, preferenceClient, paymentClient };
