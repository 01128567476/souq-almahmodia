/**
 * Register Page
 * 
 * Full registration form with email, username, phone, password validation.
 * After registration, redirects to email verification page.
 */

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { cn } from "@/utils/cn";
import { validateRegisterForm } from "@/lib/authValidation";
import { register } from "@/services/authAPI";
import { OTPInput } from "@/components/auth/OTPInput";
import { PasswordField } from "@/components/auth/PasswordField";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });

  // Step 1: Registration form
  // Step 2: Email verification (OTP)
  // Step 3: Success
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const validation = validateRegisterForm({
      fullName: formData.fullName,
      username: formData.username,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      agreeTerms: formData.agreeTerms,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      setLoading(false);
      return;
    }

    try {
      await register({
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });

      // Move to verification step
      setStep(2);
      setVerificationSent(true);
    } catch {
      setErrors({ submit: "Registration failed. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (code: string) => {
    setLoading(true);
    try {
      // Verify code via API
      const isValid = code === "123456"; // Mock verification
      if (isValid) {
        setStep(3);
      } else {
        setErrors({ otp: "Invalid verification code. Try: 123456" });
      }
    } catch {
      setErrors({ otp: "Verification failed. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  // Logo component
  const Logo = () => (
    <div className="flex justify-center mb-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-lg shadow-primary/20">
        <svg className="w-8 h-8 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
    </div>
  );

  if (step === 2) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-3 py-6 sm:px-4 sm:py-8">
        <div className="w-full max-w-md px-2">
          <Logo />
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            {/* Email verification */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                {t("verifyEmailTitle")}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                {t("verifyEmailSubtitle", { email: formData.email })}
              </p>
            </div>

            {/* OTP Input */}
            <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-6">
              <OTPInput
                length={6}
                onChange={() => {}}
                onComplete={handleOTPComplete}
                error={!!errors.otp}
              />

              {errors.otp && (
                <p className="text-sm text-red-500 text-center">{errors.otp}</p>
              )}

              {/* Resend code */}
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">
                  {t("didnReceiveCode")}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    setVerificationSent(false);
                    await new Promise((r) => setTimeout(r, 600));
                    setVerificationSent(true);
                  }}
                  disabled={loading}
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  {t("resendCode")}
                </button>
              </div>

              {/* Back to register */}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-200 transition-colors"
              >
                {t("back")}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-3 py-6 sm:px-4 sm:py-8">
        <div className="w-full max-w-md px-2">
          <Logo />
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
            {/* Success icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              {t("registrationSuccessTitle")}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mb-8">
              {t("registrationSuccessSubtitle")}
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 px-4 bg-gradient-to-r from-primary to-primary-container text-on-primary font-semibold text-sm rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-200"
            >
              {t("goToHome")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Registration form
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-3 py-6 sm:px-4 sm:py-8">
      <div className="w-full max-w-md px-2">
        <Logo />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              {t("signUpTitle")}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              {t("signUpSubtitle")}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 ml-1">
                {t("fullName")}
                <span className="text-red-500 ms-1">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                placeholder="Nour Ali"
                className={cn(
                  "w-full pl-4 pr-4 py-3 bg-white border border-gray-200 rounded-xl",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  "transition-all duration-200",
                  "text-sm text-gray-900 placeholder-gray-400",
                  errors.fullName && "border-red-300 focus:border-red-500"
                )}
              />
              {errors.fullName && (
                <p className="text-xs text-red-500 ml-1">{errors.fullName}</p>
              )}
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 ml-1">
                {t("username") || "Username"}
                <span className="text-red-500 ms-1">*</span>
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => handleChange("username", e.target.value)}
                placeholder="nourali123"
                className={cn(
                  "w-full pl-4 pr-4 py-3 bg-white border border-gray-200 rounded-xl",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  "transition-all duration-200",
                  "text-sm text-gray-900 placeholder-gray-400",
                  errors.username && "border-red-300 focus:border-red-500"
                )}
              />
              {errors.username && (
                <p className="text-xs text-red-500 ml-1">{errors.username}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="registerEmail" className="block text-sm font-medium text-gray-700 ml-1">
                {t("email")}
                <span className="text-red-500 ms-1">*</span>
              </label>
              <input
                id="registerEmail"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="name@example.com"
                className={cn(
                  "w-full pl-4 pr-4 py-3 bg-white border border-gray-200 rounded-xl",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  "transition-all duration-200",
                  "text-sm text-gray-900 placeholder-gray-400",
                  errors.email && "border-red-300 focus:border-red-500"
                )}
              />
              {errors.email && (
                <p className="text-xs text-red-500 ml-1">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 ml-1">
                {t("phone") || "Phone Number"}
                <span className="text-red-500 ms-1">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+218 91 234 5678"
                className={cn(
                  "w-full pl-4 pr-4 py-3 bg-white border border-gray-200 rounded-xl",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  "transition-all duration-200",
                  "text-sm text-gray-900 placeholder-gray-400",
                  errors.phone && "border-red-300 focus:border-red-500"
                )}
              />
              {errors.phone && (
                <p className="text-xs text-red-500 ml-1">{errors.phone}</p>
              )}
            </div>

            {/* Password */}
            <PasswordField
              id="registerPassword"
              label={`${t("password")} *`}
              placeholder="••••••••"
              error={errors.password}
            />

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 ml-1">
                {t("confirmPassword")}
                <span className="text-red-500 ms-1">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                placeholder="••••••••"
                className={cn(
                  "w-full pl-4 pr-4 py-3 bg-white border border-gray-200 rounded-xl",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  "transition-all duration-200",
                  "text-sm text-gray-900 placeholder-gray-400",
                  errors.confirmPassword && "border-red-300 focus:border-red-500"
                )}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-500 ml-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Terms checkbox */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={formData.agreeTerms}
                onChange={(e) => handleChange("agreeTerms", e.target.checked)}
                required
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary/20"
              />
              <label className="text-sm text-gray-600 leading-relaxed">
                {t.rich("agreeTerms", {
                  terms: (c) => (
                    <Link href="/terms" className="text-primary hover:underline font-medium">
                      {c}
                    </Link>
                  ),
                  privacy: (c) => (
                    <Link href="/privacy" className="text-primary hover:underline font-medium">
                      {c}
                    </Link>
                  ),
                })}
              </label>
            </div>
            {errors.agreeTerms && (
              <p className="text-xs text-red-500 ml-1">{errors.agreeTerms}</p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-primary to-primary-container text-on-primary font-semibold text-sm rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t("signUp")}...
                </>
              ) : (
                t("signUp")
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-sm text-gray-500 mt-6">
            {t("haveAccount")}{" "}
            <Link href="/" className="font-medium text-primary hover:text-primary/80 transition-colors">
              {t("signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}