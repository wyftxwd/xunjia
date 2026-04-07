const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = process.env.VERCEL === '1';
const DATA_DIR = IS_VERCEL ? '/tmp' : path.join(__dirname, 'data');
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

const EMAIL_T = {
  brandSub:   {en:'',zh:'海盟',th:'ซีวิน',vi:'SEAWIN'},
  inqTitle:   {en:'Inquiry Submitted Successfully',zh:'询价提交成功',th:'ส่งคำขอสำเร็จ',vi:'Gửi yêu cầu thành công'},
  inqBody:    {en:'Thank you for your inquiry. We have received your request and will provide a quotation within <strong>24 hours</strong>.',zh:'感谢您的询价！我们已收到您的请求，将在 <strong>24小时内</strong> 为您提供报价。',th:'ขอบคุณสำหรับคำขอของคุณ เราได้รับคำขอแล้วและจะเสนอราคาภายใน <strong>24 ชั่วโมง</strong>',vi:'Cảm ơn yêu cầu của bạn. Chúng tôi đã nhận được và sẽ báo giá trong vòng <strong>24 giờ</strong>.'},
  queryCode:  {en:'Your Query Code',zh:'您的查询码',th:'รหัสสอบถามของคุณ',vi:'Mã tra cứu của bạn'},
  keepCode:   {en:'Please keep this code safe. You can use it to check the status of your quotation at any time.',zh:'请妥善保管此查询码，您可以通过此码随时查询报价状态。',th:'กรุณาเก็บรหัสนี้ไว้ คุณสามารถใช้ตรวจสอบสถานะใบเสนอราคาได้ตลอดเวลา',vi:'Vui lòng lưu giữ mã này. Bạn có thể dùng để tra cứu trạng thái báo giá bất cứ lúc nào.'},
  quoteTitle: {en:'Your Quotation is Ready',zh:'您的报价已就绪',th:'ใบเสนอราคาของคุณพร้อมแล้ว',vi:'Báo giá của bạn đã sẵn sàng'},
  quoteBody:  {en:'Great news! We have completed the quotation for your inquiry. Please find the details below.',zh:'好消息！我们已为您的询价完成报价，以下是报价详情。',th:'ข่าวดี! เราได้จัดทำใบเสนอราคาเสร็จเรียบร้อยแล้ว รายละเอียดดังนี้',vi:'Tin vui! Chúng tôi đã hoàn thành báo giá cho yêu cầu của bạn. Chi tiết như sau.'},
  qRoute:     {en:'Route',zh:'路线',th:'เส้นทาง',vi:'Tuyến đường'},
  qMode:      {en:'Shipment Mode',zh:'运输方式',th:'รูปแบบขนส่ง',vi:'Phương thức vận chuyển'},
  qCommodity: {en:'Commodity',zh:'品名',th:'สินค้า',vi:'Hàng hóa'},
  qPrice:     {en:'Total Price',zh:'报价金额',th:'ราคารวม',vi:'Tổng giá'},
  qTransit:   {en:'Transit Time',zh:'运输时效',th:'ระยะเวลาขนส่ง',vi:'Thời gian vận chuyển'},
  qDays:      {en:'days',zh:'天',th:'วัน',vi:'ngày'},
  qValid:     {en:'Valid Until',zh:'有效期至',th:'ใช้ได้ถึง',vi:'Hiệu lực đến'},
  qBreakdown: {en:'Cost Breakdown',zh:'费用明细',th:'รายละเอียดค่าใช้จ่าย',vi:'Chi tiết chi phí'},
  qRemarks:   {en:'Remarks',zh:'备注',th:'หมายเหตุ',vi:'Ghi chú'},
  qContact:   {en:'If you have any questions, please feel free to contact us.',zh:'如有任何疑问，请随时与我们联系。',th:'หากมีข้อสงสัย กรุณาติดต่อเรา',vi:'Nếu có thắc mắc, vui lòng liên hệ chúng tôi.'},
  moreTools:  {en:'More freight rates & tools, please visit:',zh:'更多运价与工具，请访问：',th:'ดูอัตราค่าขนส่งและเครื่องมือเพิ่มเติมได้ที่:',vi:'Xem thêm giá cước và công cụ tại:'},
  regards:    {en:'Best regards,',zh:'此致敬礼，',th:'ด้วยความนับถือ,',vi:'Trân trọng,'},
};
function et(key, lang){ return EMAIL_T[key][lang] || EMAIL_T[key].en; }

function inquiryEmailHtml(code, lang) {
  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#2563EB;font-size:22px;margin:0;">SEAWIN ${et('brandSub',lang)}</h1>
  </div>
  <div style="background:#f8fafc;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
    <h2 style="color:#1e293b;margin:0 0 12px;">${et('inqTitle',lang)}</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 16px;">${et('inqBody',lang)}</p>
    <div style="background:#2563EB;color:#fff;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
      <p style="margin:0 0 6px;font-size:13px;opacity:.85;">${et('queryCode',lang)}</p>
      <p style="margin:0;font-size:30px;font-weight:700;letter-spacing:4px;">${code}</p>
    </div>
    <p style="color:#475569;line-height:1.7;margin:0;">${et('keepCode',lang)}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
    <p style="color:#475569;font-size:12.5px;margin:0 0 12px;">${et('moreTools',lang)} <a href="https://pc.iloveseawin.com/" style="color:#2563EB;text-decoration:none;font-weight:500;">pc.iloveseawin.com</a></p>
    <p style="color:#94a3b8;font-size:12px;margin:0;">${et('regards',lang)}<br>${SENDER_NAME} Team</p>
  </div>
</div>`;
}

const MODE_NAMES = {
  SEA:{en:'Sea Freight',zh:'海运',th:'ทางทะเล',vi:'Đường biển'},
  AIR:{en:'Air Freight',zh:'空运',th:'ทางอากาศ',vi:'Đường hàng không'},
  RAIL:{en:'Railway',zh:'铁路',th:'ทางรถไฟ',vi:'Đường sắt'},
  ROAD:{en:'Road',zh:'公路',th:'ทางถนน',vi:'Đường bộ'},
};

function quoteEmailHtml(inquiry, lang) {
  const q = inquiry.quote;
  const modeName = (MODE_NAMES[inquiry.shipmentMode] || {})[lang] || inquiry.shipmentMode;
  const rowStyle = 'padding:8px 0;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;';
  const labelStyle = 'color:#64748b;font-size:13px;';
  const valueStyle = 'color:#1e293b;font-size:13px;font-weight:500;text-align:right;';

  let breakdownHtml = '';
  if (q.breakdown) {
    breakdownHtml = `
    <div style="margin-top:16px;">
      <p style="color:#64748b;font-size:13px;margin:0 0 6px;">${et('qBreakdown',lang)}</p>
      <div style="background:#f8fafc;border-radius:8px;padding:12px 14px;border:1px solid #e2e8f0;">
        <pre style="margin:0;white-space:pre-wrap;font-family:inherit;font-size:12.5px;color:#334155;line-height:1.6;">${q.breakdown}</pre>
      </div>
    </div>`;
  }

  let remarksHtml = '';
  if (q.remarks) {
    remarksHtml = `
    <div style="margin-top:12px;">
      <p style="color:#64748b;font-size:13px;margin:0 0 4px;">${et('qRemarks',lang)}</p>
      <p style="color:#334155;font-size:13px;margin:0;line-height:1.6;">${q.remarks}</p>
    </div>`;
  }

  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#2563EB;font-size:22px;margin:0;">SEAWIN ${et('brandSub',lang)}</h1>
  </div>
  <div style="background:#f8fafc;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
    <h2 style="color:#1e293b;margin:0 0 12px;">${et('quoteTitle',lang)}</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 20px;">${et('quoteBody',lang)}</p>

    <div style="background:#10B981;color:#fff;border-radius:10px;padding:20px;text-align:center;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:13px;opacity:.85;">${et('qPrice',lang)}</p>
      <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:1px;">${q.currency} ${Number(q.totalPrice).toLocaleString()}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:9px 0;color:#64748b;">${et('qRoute',lang)}</td>
        <td style="padding:9px 0;color:#1e293b;font-weight:500;text-align:right;">${inquiry.origin} → ${inquiry.destination}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:9px 0;color:#64748b;">${et('qMode',lang)}</td>
        <td style="padding:9px 0;color:#1e293b;font-weight:500;text-align:right;">${modeName}</td>
      </tr>
      ${inquiry.commodity ? `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:9px 0;color:#64748b;">${et('qCommodity',lang)}</td>
        <td style="padding:9px 0;color:#1e293b;font-weight:500;text-align:right;">${inquiry.commodity}</td>
      </tr>` : ''}
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:9px 0;color:#64748b;">${et('qTransit',lang)}</td>
        <td style="padding:9px 0;color:#1e293b;font-weight:500;text-align:right;">${q.transitTime} ${et('qDays',lang)}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;color:#64748b;">${et('qValid',lang)}</td>
        <td style="padding:9px 0;color:#1e293b;font-weight:500;text-align:right;">${q.validUntil}</td>
      </tr>
    </table>
    ${breakdownHtml}
    ${remarksHtml}

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
    <p style="color:#475569;font-size:12.5px;line-height:1.6;margin:0 0 12px;">${et('qContact',lang)}</p>
    <p style="color:#475569;font-size:12.5px;margin:0 0 12px;">${et('moreTools',lang)} <a href="https://pc.iloveseawin.com/" style="color:#2563EB;text-decoration:none;font-weight:500;">pc.iloveseawin.com</a></p>
    <p style="color:#94a3b8;font-size:12px;margin:0;">${et('regards',lang)}<br>${SENDER_NAME} Team</p>
  </div>
</div>`;
}

async function sendEmail(to, type, codeOrInquiry, lang) {
  const transporter = buildTransporter();
  if (!transporter) {
    console.log(`[Email Skip] SMTP not configured. Type=${type} To=${to}`);
    return;
  }
  let subject, html;
  if (type === 'inquiry') {
    const code = codeOrInquiry;
    const subj = { zh:`询价提交成功 - 查询码: ${code}`, en:`Inquiry Submitted – Query Code: ${code}`, th:`ส่งคำขอสำเร็จ – รหัส: ${code}`, vi:`Gửi yêu cầu thành công – Mã: ${code}` };
    subject = subj[lang] || subj.en;
    html = inquiryEmailHtml(code, lang);
  } else {
    const inquiry = codeOrInquiry;
    const q = inquiry.quote;
    const subj = { zh:`报价已就绪 – ${q.currency} ${Number(q.totalPrice).toLocaleString()} | ${inquiry.origin} → ${inquiry.destination}`, en:`Quotation Ready – ${q.currency} ${Number(q.totalPrice).toLocaleString()} | ${inquiry.origin} → ${inquiry.destination}`, th:`ใบเสนอราคาพร้อมแล้ว – ${q.currency} ${Number(q.totalPrice).toLocaleString()} | ${inquiry.origin} → ${inquiry.destination}`, vi:`Báo giá đã sẵn sàng – ${q.currency} ${Number(q.totalPrice).toLocaleString()} | ${inquiry.origin} → ${inquiry.destination}` };
    subject = subj[lang] || subj.en;
    html = quoteEmailHtml(inquiry, lang);
  }
  try {
    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to, subject, html
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
    // sendEmail(inquiry.email, 'inquiry', queryCode, inquiry.lang); // TODO: 暂时禁用邮件
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
  // sendEmail(data[idx].email, 'quote', data[idx], data[idx].lang); // TODO: 暂时禁用邮件
  res.json({ success: true });
});

// Admin – delete
app.delete('/api/admin/inquiry/:code', (req, res) => {
  const data = readData().filter(i => i.queryCode !== req.params.code);
  writeData(data);
  res.json({ success: true });
});

// --------------- Start ---------------
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`\n  SEAWIN Server  →  http://localhost:${PORT}`);
    console.log(`  Admin Panel    →  http://localhost:${PORT}/admin.html`);
    console.log(`  SMTP Status    →  ${SMTP_HOST ? 'Configured ✓' : 'Not configured (emails logged to console)'}\n`);
  });
}

module.exports = app;
