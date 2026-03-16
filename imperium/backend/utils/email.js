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
const SMTP_FROM = process.env.SMTP_FROM || 'Imperium <admin@imperaagency.com>';

/**
 * Send an email. Falls back to console logging if SMTP is not configured.
 */
async function sendEmail(to, subject, html) {
  if (!transporter) {
    logger.info('\u{1F4E7} [DEV] Email would be sent:', { to, subject });
    logger.info('\u{1F4E7} [DEV] Email content:', { html });
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
 * Build branded HTML email wrapper — premium agency design
 */
function emailWrapper(content, { preheader = '' } = {}) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Imperium</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f8f6f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#f8f6f2;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ''}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f6f2;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-bottom:2px solid #f5b731;padding-bottom:12px;">
                    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:700;color:#1b2e4b;letter-spacing:0.2em;margin:0;text-transform:uppercase;">IMPERIUM</h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:8px;">
                    <p style="font-size:11px;color:#94a3b8;letter-spacing:0.15em;margin:0;text-transform:uppercase;">Gestion d'agence</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid rgba(27,46,75,0.06);box-shadow:0 4px 24px rgba(0,0,0,0.04),0 1px 2px rgba(0,0,0,0.02);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:40px 36px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="font-size:12px;color:#94a3b8;margin:0 0 8px;line-height:1.5;">
                      Cet email a \u00e9t\u00e9 envoy\u00e9 automatiquement par <strong style="color:#64748b;">Imperium</strong>.
                    </p>
                    <p style="font-size:11px;color:#cbd5e1;margin:0;">
                      \u00a9 ${new Date().getFullYear()} Impera Agency \u2014 Tous droits r\u00e9serv\u00e9s
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Styled CTA button
 */
function ctaButton(href, text) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px auto;">
      <tr>
        <td align="center" style="background:linear-gradient(135deg,#f5b731 0%,#e6a520 100%);border-radius:10px;box-shadow:0 4px 12px rgba(245,183,49,0.3);">
          <a href="${href}" target="_blank" style="display:inline-block;padding:14px 40px;font-size:15px;font-weight:700;color:#1b2e4b;text-decoration:none;letter-spacing:0.03em;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

/**
 * Info box (grey background with icon)
 */
function infoBox(text, { icon = '\u{2139}\u{FE0F}', color = '#475569' } = {}) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
      <tr>
        <td style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:14px 18px;">
          <p style="font-size:13px;color:${color};margin:0;line-height:1.6;">
            ${icon} ${text}
          </p>
        </td>
      </tr>
    </table>`;
}

/**
 * Build invitation email HTML
 */
function buildInvitationEmail(prenom, token) {
  const link = `${APP_URL}/setup-password/${token}`;
  return emailWrapper(`
    <!-- Welcome icon -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,rgba(245,183,49,0.15) 0%,rgba(245,183,49,0.05) 100%);line-height:56px;font-size:24px;">
        \u{1F44B}
      </div>
    </div>

    <h2 style="font-size:22px;font-weight:700;color:#1b2e4b;margin:0 0 6px;text-align:center;">
      Bienvenue ${prenom}\u00a0!
    </h2>
    <p style="font-size:14px;color:#94a3b8;text-align:center;margin:0 0 28px;">
      Ton compte Imperium est pr\u00eat
    </p>

    <div style="border-top:1px solid #f1f5f9;padding-top:24px;">
      <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 8px;">
        Un administrateur vient de cr\u00e9er ton compte sur la plateforme <strong style="color:#1b2e4b;">Imperium</strong>.
      </p>
      <p style="font-size:15px;color:#334155;line-height:1.7;margin:0;">
        Pour commencer, d\u00e9finis ton mot de passe en cliquant sur le bouton ci-dessous\u00a0:
      </p>
    </div>

    ${ctaButton(link, '\u{1F512} D\u00e9finir mon mot de passe')}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-top:1px solid #f1f5f9;padding-top:20px;">
          <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 16px;">
            <strong>Une fois connect\u00e9, tu pourras\u00a0:</strong>
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
            <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">\u2705 Consulter ton planning de shifts</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">\u{1F4B0} Suivre tes ventes et commissions</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">\u{1F3C6} Voir ton classement et tes primes</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">\u{1F4C4} T\u00e9l\u00e9charger tes factures</td></tr>
          </table>
        </td>
      </tr>
    </table>

    ${infoBox('Ce lien est valable <strong>48 heures</strong>. Si tu n\'as pas demand\u00e9 ce compte, tu peux ignorer cet email en toute s\u00e9curit\u00e9.', { icon: '\u23F0', color: '#64748b' })}

    <p style="font-size:11px;color:#cbd5e1;margin:20px 0 0;word-break:break-all;line-height:1.5;">
      Lien direct\u00a0: ${link}
    </p>
  `, { preheader: `${prenom}, ton compte Imperium est pr\u00eat \u2014 d\u00e9finis ton mot de passe pour commencer.` });
}

/**
 * Build email verification HTML
 */
function buildEmailVerificationEmail(prenom, token) {
  const link = `${APP_URL}/verify-email/${token}`;
  return emailWrapper(`
    <!-- Verify icon -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,rgba(59,130,246,0.15) 0%,rgba(59,130,246,0.05) 100%);line-height:56px;font-size:24px;">
        \u2709\uFE0F
      </div>
    </div>

    <h2 style="font-size:22px;font-weight:700;color:#1b2e4b;margin:0 0 6px;text-align:center;">
      Confirme ton nouvel email
    </h2>
    <p style="font-size:14px;color:#94a3b8;text-align:center;margin:0 0 28px;">
      V\u00e9rification requise
    </p>

    <div style="border-top:1px solid #f1f5f9;padding-top:24px;">
      <p style="font-size:15px;color:#334155;line-height:1.7;margin:0;">
        Salut <strong style="color:#1b2e4b;">${prenom}</strong>, tu as demand\u00e9 \u00e0 modifier ton adresse email sur Imperium. Clique sur le bouton ci-dessous pour confirmer ce changement\u00a0:
      </p>
    </div>

    ${ctaButton(link, '\u2705 Confirmer mon email')}

    ${infoBox('Ce lien est valable <strong>24 heures</strong>. Si tu n\'as pas demand\u00e9 ce changement, ignore cet email \u2014 ton adresse actuelle restera inchang\u00e9e.', { icon: '\u{1F6E1}\uFE0F', color: '#64748b' })}

    <p style="font-size:11px;color:#cbd5e1;margin:20px 0 0;word-break:break-all;line-height:1.5;">
      Lien direct\u00a0: ${link}
    </p>
  `, { preheader: `${prenom}, confirme ton nouvel email sur Imperium.` });
}

/**
 * Build password reset email HTML
 */
function buildPasswordResetEmail(prenom, token) {
  const link = `${APP_URL}/reset-password/${token}`;
  return emailWrapper(`
    <!-- Reset icon -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,rgba(239,68,68,0.12) 0%,rgba(239,68,68,0.04) 100%);line-height:56px;font-size:24px;">
        \u{1F510}
      </div>
    </div>

    <h2 style="font-size:22px;font-weight:700;color:#1b2e4b;margin:0 0 6px;text-align:center;">
      R\u00e9initialisation du mot de passe
    </h2>
    <p style="font-size:14px;color:#94a3b8;text-align:center;margin:0 0 28px;">
      Demande re\u00e7ue
    </p>

    <div style="border-top:1px solid #f1f5f9;padding-top:24px;">
      <p style="font-size:15px;color:#334155;line-height:1.7;margin:0;">
        Salut <strong style="color:#1b2e4b;">${prenom}</strong>, nous avons re\u00e7u une demande de r\u00e9initialisation de ton mot de passe. Clique sur le bouton ci-dessous pour en d\u00e9finir un nouveau\u00a0:
      </p>
    </div>

    ${ctaButton(link, '\u{1F512} R\u00e9initialiser mon mot de passe')}

    ${infoBox('Ce lien est valable <strong>1 heure</strong>. Si tu n\'as pas fait cette demande, ignore cet email \u2014 ton mot de passe actuel reste inchang\u00e9.', { icon: '\u26A0\uFE0F', color: '#92400e' })}

    <p style="font-size:11px;color:#cbd5e1;margin:20px 0 0;word-break:break-all;line-height:1.5;">
      Lien direct\u00a0: ${link}
    </p>
  `, { preheader: `${prenom}, r\u00e9initialise ton mot de passe Imperium.` });
}

module.exports = { sendEmail, buildInvitationEmail, buildEmailVerificationEmail, buildPasswordResetEmail };
