const nodemailer = require('nodemailer');

const SMTP_CONFIGURED = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

function buildTransporter() {
  if (!SMTP_CONFIGURED) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const transporter = buildTransporter();

class EmailService {
  // Sends a password reset email. In development (no SMTP config) logs to console instead.
  // Returns true if delivered, false if degraded to console.
  async sendPasswordReset({ toEmail, toName, resetUrl, expiresInMinutes }) {
    const subject = 'Reset your General Ward password';
    const text = [
      `Hi ${toName},`,
      '',
      'We received a request to reset your password for your General Ward account.',
      '',
      `Reset your password here:\n${resetUrl}`,
      '',
      `This link expires in ${expiresInMinutes} minutes. If you did not request this, you can safely ignore this email — your password has not changed.`,
      '',
      '— The General Ward team',
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
  <h2 style="margin-top: 0;">Reset your password</h2>
  <p>Hi ${escapeHtml(toName)},</p>
  <p>We received a request to reset your password for your <strong>General Ward</strong> account.</p>
  <p style="margin: 28px 0;">
    <a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
      Reset Password
    </a>
  </p>
  <p style="color:#555;font-size:13px;">
    This link expires in <strong>${expiresInMinutes} minutes</strong>. If you did not request this, you can safely ignore this email — your password has not changed.
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="color:#888;font-size:12px;">General Ward — Clinical Operations</p>
</body>
</html>`;

    if (!transporter) {
      // Dev fallback: emit to console so developers can copy the link.
      console.log('\n─── PASSWORD RESET LINK (dev only — no SMTP configured) ───');
      console.log(`To:  ${toEmail}`);
      console.log(`URL: ${resetUrl}`);
      console.log('───────────────────────────────────────────────────────────\n');
      return false;
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmail,
      subject,
      text,
      html,
    });
    return true;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = new EmailService();
