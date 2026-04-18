const APP_NAME = process.env.MAIL_APP_NAME || 'WA Blast';

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\"/g, '&quot;')
  .replace(/'/g, '&#39;');

const getBrandAssets = () => {
  const frontendBase = (process.env.FRONTEND_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
  return {
    appName: APP_NAME,
    logoUrl: process.env.MAIL_LOGO_URL || `${frontendBase}/images/waway_logo_transparent.png`,
    supportEmail: process.env.SMTP_FROM || process.env.SMTP_USER || 'support@wablast.local',
  };
};

const buildLayout = ({
  previewText,
  greeting,
  title,
  subtitle,
  buttonLabel,
  buttonUrl,
  expiryText,
  warningText,
}) => {
  const assets = getBrandAssets();

  const html = `
<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} - ${escapeHtml(assets.appName)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">
      ${escapeHtml(previewText || subtitle || title)}
    </span>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="620" style="width:620px;max-width:100%;border-collapse:separate;overflow:hidden;border-radius:18px;background:#ffffff;border:1px solid #e2e8f0;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:20px 24px;background:linear-gradient(160deg,#f8fafc 0%,#eef2ff 100%);border-bottom:1px solid #e2e8f0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <img src="${escapeHtml(assets.logoUrl)}" alt="${escapeHtml(assets.appName)}" style="height:42px;max-width:180px;display:block;object-fit:contain;" />
                    </td>
                    <td align="right" style="font-size:12px;color:#64748b;vertical-align:middle;">
                      ${escapeHtml(assets.appName)} Account Security
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:26px 24px 8px;">
                <p style="margin:0 0 8px;font-size:14px;color:#334155;">${escapeHtml(greeting)}</p>
                <h1 style="margin:0;font-size:24px;line-height:1.25;color:#0f172a;">${escapeHtml(title)}</h1>
                <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#64748b;">${escapeHtml(subtitle)}</p>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 24px 8px;">
                <a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:12px;">
                  ${escapeHtml(buttonLabel)}
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:10px 24px 6px;">
                <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">Jika tombol tidak berfungsi, salin dan buka link ini:</p>
                <p style="margin:6px 0 0;word-break:break-all;">
                  <a href="${escapeHtml(buttonUrl)}" style="font-size:12px;color:#4f46e5;text-decoration:none;">${escapeHtml(buttonUrl)}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:12px 24px 0;">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;">
                  <p style="margin:0;font-size:12px;line-height:1.6;color:#475569;">${escapeHtml(expiryText)}</p>
                </div>
              </td>
            </tr>

            ${warningText ? `
            <tr>
              <td style="padding:12px 24px 0;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#b45309;">${escapeHtml(warningText)}</p>
              </td>
            </tr>
            ` : ''}

            <tr>
              <td style="padding:18px 24px 24px;">
                <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                  Butuh bantuan? Balas email ini atau hubungi ${escapeHtml(assets.supportEmail)}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;

  const text = [
    `${assets.appName}`,
    '',
    greeting,
    title,
    subtitle,
    '',
    `${buttonLabel}: ${buttonUrl}`,
    '',
    expiryText,
    warningText || '',
    '',
    `Bantuan: ${assets.supportEmail}`,
  ].filter(Boolean).join('\n');

  return { html, text };
};

const buildVerificationEmailTemplate = ({ name, verifyUrl }) => {
  const safeName = name || 'User';
  const { html, text } = buildLayout({
    previewText: 'Verifikasi email akun WA Blast Anda.',
    greeting: `Halo ${safeName},`,
    title: 'Verifikasi Email Akun',
    subtitle: 'Satu langkah lagi untuk mengaktifkan akun dan mulai kirim campaign Anda.',
    buttonLabel: 'Verifikasi Sekarang',
    buttonUrl: verifyUrl,
    expiryText: 'Link verifikasi berlaku selama 24 jam.',
    warningText: 'Jika Anda tidak membuat akun ini, abaikan email ini.',
  });

  return {
    subject: '✅ Verifikasi Email Akun WA Blast',
    html,
    text,
  };
};

const buildResetPasswordEmailTemplate = ({ name, resetUrl }) => {
  const safeName = name || 'User';
  const { html, text } = buildLayout({
    previewText: 'Permintaan reset password akun WA Blast.',
    greeting: `Halo ${safeName},`,
    title: 'Reset Password Akun',
    subtitle: 'Kami menerima permintaan reset password. Klik tombol di bawah untuk melanjutkan.',
    buttonLabel: 'Reset Password',
    buttonUrl: resetUrl,
    expiryText: 'Link reset berlaku selama 30 menit.',
    warningText: 'Jika Anda tidak meminta reset password, abaikan email ini dan segera ubah password Anda.',
  });

  return {
    subject: '🔐 Reset Password WA Blast',
    html,
    text,
  };
};

module.exports = {
  buildVerificationEmailTemplate,
  buildResetPasswordEmailTemplate,
};
