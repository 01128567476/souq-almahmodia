/**
 * Email Service — production-grade email abstraction.
 *
 * Responsibilities:
 * - Send verification emails
 * - Send OTP emails (password reset)
 * - Send welcome emails
 * - Support Arabic and English templates
 * - Clean responsive HTML design with branding
 *
 * Architecture:
 * - EmailService interface defines the contract
 * - ResendEmailService implements the contract using Resend API
 * - Fallback NoOpEmailService for development/testing
 * - Repository layer NEVER sends emails directly
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
}

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface IEmailService {
  /** Send a verification email */
  sendVerificationEmail(to: string, token: string, locale: "ar" | "en"): Promise<void>;

  /** Send an OTP email */
  sendOtpEmail(to: string, otp: string, purpose: "reset" | "verify" | "login", locale: "ar" | "en"): Promise<void>;

  /** Send a welcome email */
  sendWelcomeEmail(to: string, name: string, locale: "ar" | "en"): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Generate HTML for verification email.
 * Clean, responsive design with branded styling.
 */
function generateVerificationTemplate(token: string, locale: "ar" | "en", name: string): EmailTemplate {
  const isAr = locale === "ar";

  const
 subject = isAr    ? "تحقق من بريدك الإلكتروني"
    : "Verify Your Email Address";

  const buttonText = isAr ? "تحقق من البريد الإلكتروني" : "Verify Email Address";
  const greeting = isAr ? `مرحباً ${name}،` : `Hello ${name},`;
  const bodyText = isAr
    ? `شكراً لتسجيلك! يرجى التحقق من بريدك الإلكتروني باستخدام الزر أدناه.`
    : `Thank you for registering! Please verify your email address using the button below.`;
  const buttonNote = isAr
    ? `إذا لم تطلب هذا، يمكنك تجاهل هذه الرسالة.`
    : `If you didn't ask for this, you can ignore this message.`;
  const expiryText = isAr
    ? `هذا الرابط صالح لمدة 24 ساعة فقط.`
    : `This link is valid for 24 hours only.`;

  const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;

  const    html = `
 <!DOCTYPE html>
    <html lang="${locale}" dir="${isAr ? 'rtl' : 'ltr'}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 18px; color: #333; margin-bottom: 20px; font-weight: 500; }
        .body-text { font-size: 16px; color: #666; line-height: 1.6; margin-bottom: 30px; }
        .button-container { text-align: center; margin: 30px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 16px 48px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; }
        .url-text { font-size: 12px; color: #999; word-break: break-all; text-align: center; margin-top: 10px; }
        .note { font-size: 14px; color: #999; text-align: center; margin-top: 30px; }
        .footer { background: #f9f9f9; padding: 20px 30px; text-align: center; }
        .footer p { margin: 0; font-size: 14px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛒 stitch_souqna</h1>
        </div>
        <div class="content">
          <p class="greeting">${greeting}</p>
          <p class="body-text">${bodyText}</p>
          <div class="button-container">
            <a href="${verificationUrl}" class="button">${buttonText}</a>
            <p class="url-text">${verificationUrl}</p>
          </div>
          <p class="note">${expiryText}</p>
          <p class="note">${buttonNote}</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} stitch_souqna. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `${greeting}\n\n${bodyText}\n\n${buttonText}: ${verificationUrl}\n\n${expiryText}\n\n${buttonNote}`;

  return { subject, text, html };
}

/**
 * Generate HTML for OTP email.
 * Clean, responsive design with prominent OTP display.
 */
function generateOtpTemplate(otp: string, purpose: "reset" | "verify" | "login", locale: "ar" | "en"): EmailTemplate {
  const isAr = locale === "ar";

  const subject = isAr
    ? "رمز التحقق الخاص بك"
    : "Your Verification Code";

  const greeting = isAr ? "مرحباً،" : "Hello,";
  const bodyText = isAr
    ? `رمز التحقق الخاص بك هو:`
    : `Your verification code is:`;
  const purposeText = purpose === "reset"
    ? (isAr ? "لإعادة تعيين كلمة المرور الخاصة بك." : "to reset your password.")
    : purpose === "verify"
    ? (isAr ? "لتأكيد بريدك الإلكتروني." : "to verify your email address.")
    : (isAr ? "لتسجيل الدخول إلى حسابك." : "to sign in to your account.");
  const note = isAr
    ? `هذا الرمز صالح لمدة 5 دقائق فقط. مشاركة هذا الرمز مع أي شخص تعني المخاطرة بأمان حسابك.`
    : `This code is valid for 5 minutes only. Sharing this code with anyone means risking your account security.`;
  const dontShare = isAr
    ? `لا تشارك هذا الرمز مع أي شخص.`
    : `Do not share this code with anyone.`;

  const html = `
    <!DOCTYPE html>
    <html lang="${locale}" dir="${isAr ? 'rtl' : 'ltr'}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 18px; color: #333; margin-bottom: 20px; font-weight: 500; }
        .body-text { font-size: 16px; color: #666; line-height: 1.6; margin-bottom: 20px; }
        .otp-container { text-align: center; margin: 40px 0; }
        .otp-code { display: inline-block; font-size: 48px; font-weight: 700; letter-spacing: 12px; color: #667eea; background: #f0f0ff; padding: 20px 40px; border-radius: 12px; font-family: 'Courier New', monospace; }
        .note { font-size: 14px; color: #999; text-align: center; margin-top: 30px; line-height: 1.6; }
        .warning { font-size: 14px; color: #e74c3c; text-align: center; margin-top: 20px; font-weight: 600; }
        .footer { background: #f9f9f9; padding: 20px 30px; text-align: center; }
        .footer p { margin: 0; font-size: 14px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛒 stitch_souqna</h1>
        </div>
        <div class="content">
          <p class="greeting">${greeting}</p>
          <p class="body-text">${bodyText} ${purposeText}</p>
          <div class="otp-container">
            <div class="otp-code">${otp}</div>
          </div>
          <p class="note">${note}</p>
          <p class="warning">${dontShare}</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} stitch_souqna. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `${greeting}\n\n${bodyText} ${purposeText}\n\n${otp}\n\n${note}\n\n${dontShare}`;

  return { subject, text, html };
}

/**
 * Generate HTML for welcome email.
 */
function generateWelcomeTemplate(name: string, locale: "ar" | "en"): EmailTemplate {
  const isAr = locale === "ar";

  const subject = isAr
    ? `مرحباً ${name}، سعيدون بانضمامك إلينا!`
    : `Welcome ${name}, we're glad you're here!`;

  const greeting = isAr ? `مرحباً ${name}،` : `Hello ${name},`;
  const bodyText = isAr
    ? `شكراً لانضمامك إلى stitch_souqna! الآن يمكنك بدء نشر إعلاناتك واستكشاف السوق.`
    : `Thank you for joining stitch_souqna! You can now start posting listings and exploring the marketplace.`;
  const footer = isAr
    ? `مع تحيات، فريق stitch_souqna`
    : `Best regards,\nThe stitch_souqna Team`;

  const html = `
    <!DOCTYPE html>
    <html lang="${locale}" dir="${isAr ? 'rtl' : 'ltr'}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 18px; color: #333; margin-bottom: 20px; font-weight: 500; }
        .body-text { font-size: 16px; color: #666; line-height: 1.6; margin-bottom: 20px; }
        .footer { background: #f9f9f9; padding: 20px 30px; text-align: center; }
        .footer p { margin: 0; font-size: 14px;
        color: #999; } .signature { font-size: 16px; color: #333; margin-top: 30px; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛒 stitch_souqna</h1>
        </div>
        <div class="content">
          <p class="greeting">${greeting}</p>
          <p class="body-text">${bodyText}</p>
          <p class="signature">${footer}</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} stitch_souqna. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `${greeting}\n\n${bodyText}\n\n${footer}`;

  return { subject, text, html };
}

/* -------------------------------------------------------------------------- */
/* Resend Email Service (Production)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Resend-based email service implementation.
 * Uses the Resend API for sending emails.
 *
 * Environment variable: RESEND_API_KEY
 */
export class ResendEmailService implements IEmailService
 {
  private apiKey: string;  private fromAddress: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || "";
    this.fromAddress = process.env.EMAIL_FROM || "noreply@stitchsouqna.com";
  }

  private async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.apiKey) {
      console.warn("[EmailService] RESEND_API_KEY not configured. Skipping email send.");
      return;
    }

    try {
      const from = options.to.length === 1
        ? `${process.env.EMAIL_FROM_NAME || "stitch_souqna"} <${this.fromAddress}>`
        : `${process.env.EMAIL_FROM_NAME || "stitch_souqna"} <${this.fromAddress}>`;

      const body = {
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();

      if (!response.ok) {
        console.error("[EmailService] Resend API error:", response.status, responseText);
        throw new Error(`Email send failed: ${response.status} ${response.statusText}`);
      }

      let responseData;
      try {

               responseData = JSON.parse(responseText); if (responseData.id) {
          console.log("[EmailService] Email sent successfully, ID:", responseData.id);
        }
      } catch {
        // Response is not JSON, ignore
      }
    } catch (error) {
      console.error("[EmailService] Failed to send email:", error);
      throw error;
    }
  }

  async sendVerificationEmail(to: string, token: string, locale: "ar" | "en"): Promise<void> {
    // Get user name from DB if needed — fallback to "User"
    const template = generateVerificationTemplate(token, locale, "User");
    await this.sendEmail({
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  async sendOtpEmail(to: string, otp: string, purpose: "reset" | "verify" | "login", locale: "ar" | "en"): Promise<void> {
    const template = generateOtpTemplate(otp, purpose, locale);
    await this.sendEmail({
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  async sendWelcomeEmail(to: string, name: string, locale: "ar" | "en"): Promise<void> {
    const template = generateWelcomeTemplate(name, locale);
    await this.sendEmail({
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* NoOp Email Service (Development/Testing)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Development email service — logs OTP to console instead of sending.
 * Used when RESEND_API_KEY is not configured.
 */
export class NoOpEmailService implements IEmailService {
  async sendVerificationEmail(to: string, token: string, locale: "ar" | "en"): Promise<void> {
    console.log(`\n[DEV EMAIL] Verification Token for ${to}: ${token}\n`);
  }

  async sendOtpEmail(to: string, otp: string, purpose: "reset" | "verify" | "login", locale: "ar" | "en"): Promise<void> {
    console.log(`\n[DEV EMAIL] OTP for ${to}: ${otp} (purpose: ${purpose})\n`);
  }

  async sendWelcomeEmail(to: string, name: string, locale: "ar" | "en"): Promise<void> {
    console.log(`\n[DEV EMAIL] Welcome email for ${name} (${to})\n`);
  }
}

/* --------------------------------------------------------------------------                                                                    */
/* Factory */
/* -------------------------------------------------------------------------- */

/**
 * Get the email service instance.
 * Returns ResendEmailService if RESEND_API_KEY is set, otherwise NoOpEmailService.
 */
let emailServiceInstance: IEmailService | null = null;

export function getEmailService(): IEmailService {
  if (emailServiceInstance === null) {
    if (process.env.RESEND_API_KEY) {
      emailServiceInstance = new ResendEmailService();
    } else {
      emailServiceInstance = new NoOpEmailService();
    }

  }
  return emailServiceInstance;
}