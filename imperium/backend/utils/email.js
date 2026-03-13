const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create transporter — falls back to console logging if SMTP not configured
let transporter = null;

if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const SMTP_FROM = process.env.SMTP_FROM || 'Imperium <admin@impera-agency.com>';

/**
 * Send an email. Falls back to console logging if SMTP is not configured.
 */
async function sendEmail(to, subject, html) {
  if (!transporter) {
    logger.info('📧 [DEV] Email would be sent:', { to, subject });
    logger.info('📧 [DEV] Email content:', { html });
    return { dev: true, to, subject };
  }

  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
  });

  logger.info('Email sent', { to, subject, messageId: info.messageId });
  return info;
}

/**
 * Build branded HTML email wrapper
 */
function emailWrapper(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:500px;margin:40px auto;padding:0 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;color:#1b2e4b;letter-spacing:0.15em;margin:0;">IMPERIUM</h1>
      <p style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;margin:4px 0 0;">TABLEAU DE BORD</p>
    </div>
    <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid rgba(0,0,0,0.08);box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      ${content}
    </div>
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:24px;">
      Cet email a \u00e9t\u00e9 envoy\u00e9 automatiquement par Imperium. Ne r\u00e9pondez pas \u00e0 ce message.
    </p>
  </div>
</body>
</html>`;
}

/**
 * Build invitation email HTML
 */
function buildInvitationEmail(prenom, token) {
  const link = `${APP_URL}/setup-password/${token}`;
  return emailWrapper(`
    <h2 style="font-size:20px;font-weight:700;color:#1b2e4b;margin:0 0 8px;">Bienvenue ${prenom} !</h2>
    <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px;">
      Ton compte Imperium a \u00e9t\u00e9 cr\u00e9\u00e9. Clique sur le bouton ci-dessous pour d\u00e9finir ton mot de passe et acc\u00e9der \u00e0 la plateforme.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#f5b731;color:#1b2e4b;font-weight:700;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.02em;">
        D\u00e9finir mon mot de passe
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;margin:24px 0 0;line-height:1.5;">
      Ce lien est valable <strong>48 heures</strong>. Si tu n'as pas demand\u00e9 ce compte, ignore cet email.
    </p>
    <p style="font-size:11px;color:#cbd5e1;margin:16px 0 0;word-break:break-all;">${link}</p>
  `);
}

/**
 * Build email verification HTML
 */
function buildEmailVerificationEmail(prenom, token) {
  const link = `${APP_URL}/verify-email/${token}`;
  return emailWrapper(`
    <h2 style="font-size:20px;font-weight:700;color:#1b2e4b;margin:0 0 8px;">Confirme ton nouvel email</h2>
    <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px;">
      Salut ${prenom}, tu as demand\u00e9 \u00e0 changer ton adresse email. Clique sur le bouton ci-dessous pour confirmer ce changement.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#f5b731;color:#1b2e4b;font-weight:700;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.02em;">
        Confirmer mon email
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;margin:24px 0 0;line-height:1.5;">
      Ce lien est valable <strong>24 heures</strong>. Si tu n'as pas demand\u00e9 ce changement, ignore cet email.
    </p>
    <p style="font-size:11px;color:#cbd5e1;margin:16px 0 0;word-break:break-all;">${link}</p>
  `);
}

module.exports = { sendEmail, buildInvitationEmail, buildEmailVerificationEmail };
