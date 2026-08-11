# Backend de Doações — Instituto Akachi

Backend em Node.js/Express que integra **Mercado Pago** (Checkout Pro) e
**Postgres** pra processar as doações do site.

## O que ele faz

1. Recebe do front-end: nome, e-mail, telefone, valor e periodicidade da doação.
2. Grava a doação no Postgres com status `pending`.
3. Cria uma preferência de pagamento no Mercado Pago e devolve a URL de checkout.
4. O doador é redirecionado pro checkout **seguro do próprio Mercado Pago**
   (nenhum dado de cartão passa pelo nosso servidor).
5. Quando o pagamento muda de status, o Mercado Pago chama nosso webhook,
   que atualiza o status da doação no banco (`approved`, `rejected`, etc.).

## Por que precisa de um backend

O *Access Token* do Mercado Pago é uma chave **secreta** — ela nunca pode
aparecer no código do site (HTML/JS que roda no navegador do doador), senão
qualquer pessoa poderia usá-la pra criar cobranças em nome de vocês. Por
isso essa parte roda num servidor separado, que guarda o token em variável
de ambiente.

---

## 1. Configurar o Mercado Pago

1. Crie/acesse uma conta em [mercadopago.com.br](https://www.mercadopago.com.br).
2. Vá em **[developers.mercadopago.com/panel](https://www.mercadopago.com.br/developers/panel/app)**
   e crie uma aplicação.
3. Copie o **Access Token de produção** (não o de teste, quando for pra valer).
4. Guarde essa chave com cuidado — ela vai entrar na variável `MP_ACCESS_TOKEN`.

## 2. Criar o banco Postgres

Qualquer provedor de Postgres gerenciado serve. Sugestões com plano gratuito:

- [Neon](https://neon.tech) (recomendado — bem simples de configurar)
- [Supabase](https://supabase.com)
- [Railway](https://railway.app)

Depois de criar o banco, copie a **connection string** (formato
`postgres://usuario:senha@host:5432/banco`) — ela vai entrar na variável
`DATABASE_URL`.

Depois, rode a migration pra criar as tabelas:

```bash
npm run migrate
```

(ou rode o SQL de `migrations/001_create_donations.sql` direto no painel do
provedor, tipo o SQL Editor do Neon/Supabase.)

## 3. Rodar localmente

```bash
cp .env.example .env
# preencha o .env com os valores reais
npm install
npm run dev
```

O servidor sobe em `http://localhost:3000`. Teste com:

```bash
curl http://localhost:3000/health
```

## 4. Publicar (deploy)

Sugestão simples: **[Render](https://render.com)** (tem plano gratuito pra
Web Service).

1. Suba esse projeto (pasta `akachi-backend`) num repositório Git (GitHub, por exemplo).
2. No Render, crie um **Web Service** apontando pro repositório.
   - Build command: `npm install`
   - Start command: `npm start`
3. Em **Environment**, cadastre as mesmas variáveis do `.env.example`
   (com os valores reais).
4. Depois do deploy, copie a URL pública gerada (tipo
   `https://akachi-backend.onrender.com`) e:
   - Atualize `BACKEND_URL` nas variáveis de ambiente do próprio serviço.
   - Configure essa mesma URL + `/api/webhooks/mercadopago` como notification
     URL no painel do Mercado Pago (ou deixe como está — o código já manda
     isso automaticamente em cada preferência criada).

## 5. Ligar o front-end

No arquivo `doacao.html` do site, tem uma constante:

```js
const API_BASE_URL = "https://SEU-BACKEND.onrender.com";
```

Troque pela URL real do backend depois do deploy.

---

## Sobre doações mensais (recorrentes)

O Checkout Pro (usado aqui) processa muito bem **doações únicas**. Para
cobranças **recorrentes de verdade** (débito automático mensal), o Mercado
Pago tem uma API separada, a de **Assinaturas (Preapproval)**, com fluxo
próprio de criação e gestão de assinatura. O código atual já grava a
`periodicity` no banco e cria a preferência corretamente, mas pra automatizar
a cobrança do mês seguinte, será preciso integrar essa API adicional — posso
implementar isso como próximo passo, se for prioridade de vocês.

## Segurança

- Nunca comite o arquivo `.env`.
- Nunca coloque `MP_ACCESS_TOKEN` no código do front-end.
- O webhook busca os dados do pagamento direto na API do Mercado Pago (não
  confia cegamente no corpo da notificação recebida), seguindo a
  recomendação oficial de segurança.
