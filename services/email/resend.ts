/**
 * Email service — Resend API integration.
 *
 * Uses Resend (resend.com) for production email delivery.
 * Falls back to console log when API key is not configured.
 *
 * NO fake "success" responses. Either sends real email or logs the failure.
 */

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email via Resend API.
 * Returns { success: true } on success, { success: false, error: string } on failure.
 */
export async function sendEmail(payload: EmailPayload): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // No API key — log and return failure (don't fake success)
    console.warn("[EMAIL] RESEND_API_KEY not configured — email NOT sent");
    console.warn(`[EMAIL] Would send to: ${payload.to}, subject: ${payload.subject}`);
    console.warn(`[EMAIL] HTML: ${payload.html.substring(0, 200)}...`);
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "SouqNa <noreply@resend.domain>",
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      } as any),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[EMAIL] Resend API error (${response.status}):`, errorBody);
      return { success: false, error: `Resend API error: ${response.status}` };
    }

    const data = await response.json();
    console.log(`[EMAIL] Sent successfully: ${data.id}`);
    return { success: true, id: data.id };
  } catch (error) {
    console.error("[EMAIL] Send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Send OTP email with standardized template.
 */
export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: "login" | "verify" | "reset",
): Promise<{ success: boolean; error?: string }> {
  const purposeLabels = {
    login: "log in to your account",
    verify: "verify your email address",
    reset: "reset your password",
  };

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>رمز التحقق</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; margin-bottom: 24px; text-align: center; }
        h1 { font-size: 20px; color: #333; margin-bottom: 16px; }
        .otp-code { font-size: 42px; font-weight: bold; color: #2563eb; text-align: center; letter-spacing: 8px; margin: 24px 0; padding: 16px; background: #f0f4ff; border-radius: 8px; font-family: monospace; }
        .message { color: #666; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
        .warning { background: #fff3cd; border-radius: 8px; padding: 12px; font-size: 13px; color: #856404; margin-top: 16px; }
        .footer { color: #999; font-size: 12px; text-align: center; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">سوق المحمودية</div>
        <h1>رمز التحقق</h1>
        <p class="message">
          استخدم الرمز التالي ${purposeLabels[purpose]}:
        </p>
        <div class="otp-code">${code}</div>
        <div class="warning">
          ⚠️ هذا الرمز صالح لمدة 10 دقائق فقط. لا تشاركه مع أي شخص.
        </div>
        <div class="footer">
          إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.
        </div>
      </div>
    </body>
    </html>
  `.trim();

  const text = `رمز التحقق: ${code}\n\nهذا الرمز صالح لمدة 10 دقائق فقط.\n\nإذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.`;

  return sendEmail({
    to,
    subject: `[SouqNa] رمز التحقق: ${code}`,
    html,
    text,
  });
}

/**
 * Send password reset email.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px;">
        <h1 style="color: #333;">إعادة تعيين كلمة المرور</h1>
        <p style="color: #666; line-height: 1.6;">
          تم طلب إعادة تعيين كلمة المرور. انقر على الرابط التالي لإعادة تعيينها:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            إعادة تعيين كلمة المرور
          </a>
        </div>
        <p style="color: #999; font-size: 13px; text-align: center;">
          هذا الرابط صالح لمدة 30 دقيقة فقط.
        </p>
      </div>
    </body>
    </html>
  `.trim();

  return sendEmail({
    to,
    subject: "[SouqNa] إعادة تعيين كلمة المرور",
    html,
    text: `إعادة تعيين كلمة المرور: ${resetUrl}`,
  });
}

/**
 * Send account verification email.
 */
export async function sendVerificationEmail(
  to: string,
  verifyUrl: string,
): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px;">
        <h1 style="color: #333;">التحقق من البريد الإلكتروني</h1>
        <p style="color: #666; line-height: 1.6;">
          شكراً لك! انقر على الرابط التالي للتحقق من بريدك الإلكتروني:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            التحقق من البريد
          </a>
        </div>
        <p style="color: #999; font-size: 13px; text-align: center;">
          هذا الرابط صالح لمدة 24 ساعة فقط.
        </p>
      </div>
    </body>
    </html>
  `.trim();

  return sendEmail({
    to,
    subject: "[SouqNa] تحقق من بريدك الإلكتروني",
    html,
    text: `تحقق من بريدك: ${verifyUrl}`,
  });
}