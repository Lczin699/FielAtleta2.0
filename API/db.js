const { Pool } = require('pg');

// DATABASE_URL vem do provedor de Postgres (Neon, Supabase, Railway, RDS, etc.)
// Formato: postgres://usuario:senha@host:5432/nome_do_banco
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }, // necessário para a maioria dos provedores gerenciados
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do Postgres:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
