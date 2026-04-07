const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'inquiries.json');

// --------------- SMTP Config (placeholder – fill in later) ---------------
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SENDER_NAME = process.env.SENDER_NAME || 'SEAWIN';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@xunjia.com';

// --------------- Middleware ---------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --------------- Data helpers ---------------
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}
function writeData(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8'); }

function generateQueryCode() {
  const existing = new Set(readData().map(i => i.queryCode));
  let code;
  do { code = String(Math.floor(10000000 + Math.random() * 90000000)); }
  while (existing.has(code));
  return code;
}

// --------------- Email ---------------
function buildTransporter() {
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

function inquiryEmailHtml(code, lang) {
  const isEn = lang === 'en';
  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#2563EB;font-size:22px;margin:0;">SEAWIN ${isEn ? '' : '海盟'}</h1>
  </div>
  <div style="background:#f8fafc;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
    <h2 style="color:#1e293b;margin:0 0 12px;">${isEn ? 'Inquiry Submitted Successfully' : '询价提交成功'}</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 16px;">
      ${isEn
        ? 'Thank you for your inquiry. We have received your request and will provide a quotation within <strong>24 hours</strong>.'
        : '感谢您的询价！我们已收到您的请求，将在 <strong>24小时内</strong> 为您提供报价。'}
    </p>
    <div style="background:#2563EB;color:#fff;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
      <p style="margin:0 0 6px;font-size:13px;opacity:.85;">${isEn ? 'Your Query Code' : '您的查询码'}</p>
      <p style="margin:0;font-size:30px;font-weight:700;letter-spacing:4px;">${code}</p>
    </div>
    <p style="color:#475569;line-height:1.7;margin:0;">
      ${isEn
        ? 'Please keep this code safe. You can use it to check the status of your quotation at any time.'
        : '请妥善保管此查询码，您可以通过此码随时查询报价状态。'}
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">${isEn ? 'Best regards,' : '此致敬礼，'}<br>${SENDER_NAME} Team</p>
  </div>
</div>`;
}

function quoteEmailHtml(code, lang) {
  const isEn = lang === 'en';
  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#2563EB;font-size:22px;margin:0;">SEAWIN ${isEn ? '' : '海盟'}</h1>
  </div>
  <div style="background:#f8fafc;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
    <h2 style="color:#1e293b;margin:0 0 12px;">${isEn ? 'Quotation Ready' : '报价已就绪'}</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 16px;">
      ${isEn
        ? 'Great news! Your quotation is now ready. Please use the query code below to view the details.'
        : '好消息！您的报价已准备就绪，请使用以下查询码查看详细报价信息。'}
    </p>
    <div style="background:#10B981;color:#fff;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
      <p style="margin:0 0 6px;font-size:13px;opacity:.85;">${isEn ? 'Your Query Code' : '您的查询码'}</p>
      <p style="margin:0;font-size:30px;font-weight:700;letter-spacing:4px;">${code}</p>
    </div>
    <p style="color:#475569;line-height:1.7;margin:0;">
      ${isEn
        ? 'Visit our website and enter this code to view your quotation details.'
        : '请访问我们的网站并输入此码查看报价详情。'}
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">${isEn ? 'Best regards,' : '此致敬礼，'}<br>${SENDER_NAME} Team</p>
  </div>
</div>`;
}

async function sendEmail(to, type, code, lang) {
  const transporter = buildTransporter();
  if (!transporter) {
    console.log(`[Email Skip] SMTP not configured. Type=${type} To=${to} Code=${code}`);
    return;
  }
  const subjectMap = {
    inquiry: { zh: `询价提交成功 - 查询码: ${code}`, en: `Inquiry Submitted – Query Code: ${code}` },
    quote:   { zh: `报价已就绪 - 查询码: ${code}`,   en: `Quotation Ready – Query Code: ${code}` }
  };
  const html = type === 'inquiry' ? inquiryEmailHtml(code, lang) : quoteEmailHtml(code, lang);
  try {
    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to, subject: subjectMap[type][lang] || subjectMap[type].en, html
    });
    console.log(`[Email OK] ${type} → ${to}`);
  } catch (err) {
    console.error(`[Email ERR] ${to}: ${err.message}`);
  }
}

// --------------- API Routes ---------------

// Submit inquiry
app.post('/api/inquiry', async (req, res) => {
  try {
    const data = readData();
    const queryCode = generateQueryCode();
    const inquiry = {
      queryCode,
      shipmentMode: req.body.shipmentMode,
      tradeTerms: req.body.tradeTerms,
      origin: req.body.origin,
      destination: req.body.destination,
      cargoReadyDate: req.body.cargoReadyDate,
      commodity: req.body.commodity,
      grossWeight: req.body.grossWeight,
      volume: req.body.volume,
      pieces: req.body.pieces,
      containerType: req.body.containerType || '',
      containerQty: req.body.containerQty || '',
      specialCargo: req.body.specialCargo || [],
      companyName: req.body.companyName,
      contactPerson: req.body.contactPerson,
      email: req.body.email,
      phone: req.body.phone,
      remarks: req.body.remarks || '',
      lang: req.body.lang || 'zh',
      status: 'pending',
      quote: null,
      createdAt: new Date().toISOString(),
      quotedAt: null
    };
    data.push(inquiry);
    writeData(data);
    sendEmail(inquiry.email, 'inquiry', queryCode, inquiry.lang);
    res.json({ success: true, queryCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Query by code (public)
app.get('/api/query/:code', (req, res) => {
  const inquiry = readData().find(i => i.queryCode === req.params.code);
  if (!inquiry) return res.json({ success: false, error: 'not_found' });
  if (inquiry.status !== 'quoted') {
    return res.json({
      success: true, status: 'pending',
      inquiry: {
        shipmentMode: inquiry.shipmentMode,
        origin: inquiry.origin,
        destination: inquiry.destination,
        createdAt: inquiry.createdAt
      }
    });
  }
  res.json({
    success: true, status: 'quoted',
    inquiry: {
      shipmentMode: inquiry.shipmentMode,
      tradeTerms: inquiry.tradeTerms,
      origin: inquiry.origin,
      destination: inquiry.destination,
      cargoReadyDate: inquiry.cargoReadyDate,
      commodity: inquiry.commodity,
      grossWeight: inquiry.grossWeight,
      volume: inquiry.volume,
      pieces: inquiry.pieces,
      containerType: inquiry.containerType,
      containerQty: inquiry.containerQty,
      createdAt: inquiry.createdAt
    },
    quote: inquiry.quote
  });
});

// Admin – list all
app.get('/api/admin/inquiries', (_req, res) => {
  res.json(readData().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// Admin – submit quote
app.put('/api/admin/quote/:code', async (req, res) => {
  const data = readData();
  const idx = data.findIndex(i => i.queryCode === req.params.code);
  if (idx === -1) return res.status(404).json({ success: false, error: 'not_found' });

  data[idx].status = 'quoted';
  data[idx].quote = {
    currency: req.body.currency,
    totalPrice: req.body.totalPrice,
    transitTime: req.body.transitTime,
    validUntil: req.body.validUntil,
    breakdown: req.body.breakdown || '',
    remarks: req.body.remarks || ''
  };
  data[idx].quotedAt = new Date().toISOString();
  writeData(data);
  sendEmail(data[idx].email, 'quote', data[idx].queryCode, data[idx].lang);
  res.json({ success: true });
});

// Admin – delete
app.delete('/api/admin/inquiry/:code', (req, res) => {
  const data = readData().filter(i => i.queryCode !== req.params.code);
  writeData(data);
  res.json({ success: true });
});

// --------------- Start ---------------
app.listen(PORT, () => {
  console.log(`\n  SEAWIN Server  →  http://localhost:${PORT}`);
  console.log(`  Admin Panel    →  http://localhost:${PORT}/admin.html`);
  console.log(`  SMTP Status    →  ${SMTP_HOST ? 'Configured ✓' : 'Not configured (emails logged to console)'}\n`);
});
