const nodemailer = require('nodemailer');

const getBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: getBoolean(process.env.SMTP_SECURE, port === 465),
    auth: { user, pass },
  });

  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const tx = getTransporter();

  if (!tx) {
    console.warn('[MailService] SMTP is not configured. Email skipped.');
    return { sent: false, skipped: true };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await tx.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return { sent: true };
}

module.exports = {
  sendMail,
};
