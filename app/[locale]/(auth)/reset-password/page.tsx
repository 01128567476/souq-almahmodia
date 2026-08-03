/**
 * Reset Password Page
 * 
 * Step 3: After OTP verification, enter new password
 */

"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { cn } from "@/utils/cn";
import { PasswordField } from "@/components/auth/PasswordField";
import { validatePassword, validateConfirmPassword } from "@/lib/authValidation";
import { resetPassword } from "@/services/authAPI";

/**
 * `useSearchParams` opts a component into client-side rendering, so it needs a
 * Suspense boundary for the page to prerender.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

/** Matches the form's page chrome so the boundary doesn't flash a layout shift. */
function ResetPasswordFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:px-12">
      <div className="w-full max-w-[420px]">
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 px-5 py-6 sm:px-6 sm:py-8 md:px-8 md:py-8 flex justify-center">
          <svg className="w-6 h-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") || "";
  const codeFromQuery = searchParams.get("code") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    if (!emailFromQuery || !codeFromQuery) {
      router.push("/forgot-password");
    }
  }, [emailFromQuery, codeFromQuery, router]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});

      if (!emailFromQuery || !codeFromQuery) {
        setErrors({ general: t("serverError") });
        return;
      }

      const passwordError = validatePassword(password);
      if (!passwordError) {
        const confirmError = validateConfirmPassword(password, confirmPassword);
        if (confirmError) {
          setErrors({ confirmPassword: confirmError });
          return;
        }
      }
      if (passwordError) {
        setErrors({ password: passwordError });
        return;
      }

      setLoading(true);

      try {
        const result = await resetPassword({
          email: emailFromQuery,
          code: codeFromQuery,
          newPassword: password,
        });

        if (result.success) {
          setSuccess(true);
        } else {
          setErrors({ general: result.message || t("serverError") });
        }
      } catch {
        setErrors({ general: t("serverError") });
      } finally {
        setLoading(false);
      }
    },
    [emailFromQuery, codeFromQuery, password, confirmPassword, t]
  );

  const handleBack = useCallback(() => {
    router.push("/forgot-password");
  }, [router]);

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:px-12">
        <div className="w-full max-w-[420px]">
          {/* Logo */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-lg shadow-primary/20">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-on-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 px-5 py-6 sm:px-6 sm:py-8 md:px-8 md:py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 tracking-tight">
              {t("passwordResetSuccessTitle")}
            </h1>

            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed mb-6">
              {t("passwordResetSuccessSubtitle")}
            </p>

            <Link
              href="/"
              className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 active:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 transition-all duration-200"
            >
              {t("backToSignIn")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:px-12">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-lg shadow-primary/20">
            <svg
              className="w-6 h-6 sm:w-8 sm:h-8 text-on-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 px-5 py-6 sm:px-6 sm:py-8 md:px-8 md:py-8">
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <svg
                className="w-7 h-7 sm:w-8 sm:h-8 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 tracking-tight">
              {t("resetPasswordTitle")}
            </h1>

            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-[280px] mx-auto">
              {t("resetPasswordSubtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Password Field */}
            <div className="space-y-1.5">
              <PasswordField
                id="newPassword"
                label={t("newPassword")}
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                }}
                error={errors.password}
              />
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <PasswordField
                id="confirmPassword"
                label={t("confirmPassword")}
                value={confirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value);
                  if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                }}
                error={errors.confirmPassword}
              />
            </div>

            {/* General Error */}
            {errors.general && (
              <div
                className="flex items-start gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm"
                role="alert"
                aria-live="assertive"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="leading-relaxed">{errors.general}</span>
              </div>
            )}

            {/* Reset Button */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full py-3 px-4 rounded-xl font-semibold text-sm",
                "bg-gradient-to-r from-primary to-primary-container text-on-primary",
                "shadow-lg shadow-primary/20",
                "hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5",
                "active:translate-y-0 active:shadow-lg",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2",
                "transition-all duration-200",
                "flex items-center justify-center gap-2",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg"
              )}
            >
              {loading ? (
                <>
                  <svg
                    className="w-5 h-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {t("resetting")}
                </>
              ) : (
                t("resetPasswordButton")
              )}
            </button>

            {/* Back Button */}
            <button
              type="button"
              onClick={handleBack}
              className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-200 active:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200"
            >
              {t("back")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}