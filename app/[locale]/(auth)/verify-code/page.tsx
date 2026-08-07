/**
 * Verify Code (OTP) Page
 * 
 * Premium OTP verification page — production-quality, responsive, accessible, backend-ready.
 */

"use client";

import { useState, useCallback, useRef, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { cn } from "@/utils/cn";
import { OTPInput } from "@/components/auth/OTPInput";
import { verifyResetCode } from "@/services/authAPI";

type ErrorType =
  | "invalid"
  | "expired"
  | "incorrect"
  | "network"
  | "server"
  | "too-many-attempts"
  | null;

function ResendTimer() {
  const t = useTranslations("auth");
  const [countdown, setCountdown] = useState(60);
  const [isRunning, setIsRunning] = useState(true);

  useCallback(() => {
    if (!isRunning || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, countdown]);

  if (!isRunning && countdown === 0) return null;

  const minutes = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const display = `${minutes}:${secs.toString().padStart(2, "0")}`;

  return (
    <span className="inline-flex items-center gap-1.5">
      <svg
        className="w-3.5 h-3.5 animate-spin text-primary"
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
      <span className="text-xs font-medium text-primary tabular-nums">
        {display}
      </span>
    </span>
  );
}

function ErrorMessageComponent({ type, t }: { type: ErrorType; t: ReturnType<typeof useTranslations> }) {
  if (!type) return null;

  const messages: Record<string, string> = {
    invalid: t("invalidCode"),
    expired: t("expiredCode"),
    incorrect: t("incorrectCode"),
    network: t("networkError"),
    server: t("serverError"),
    "too-many-attempts": t("tooManyAttempts"),
  };

  return (
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
      <span className="leading-relaxed">{messages[type]}</span>
    </div>
  );
}

/**
 * `useSearchParams` opts a component into client-side rendering, so it needs a
 * Suspense boundary for the page to prerender.
 */
export default function VerifyCodePage() {
  return (
    <Suspense fallback={<VerifyCodeFallback />}>
      <VerifyCodeForm />
    </Suspense>
  );
}

/** Matches the form's page chrome so the boundary doesn't flash a layout shift. */
function VerifyCodeFallback() {
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

function VerifyCodeForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") || "";

  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<ErrorType>(null);

  const formRef = useRef<HTMLFormElement>(null);

  const handleOtpComplete = useCallback(
    async (fullCode: string) => {
      if (fullCode.length !== 6 || !emailFromQuery) return;

      setError(null);
      setLoading(true);

      try {
        const result = await verifyResetCode({ email: emailFromQuery, code: fullCode });

        if (result.success) {
          router.push(`/reset-password?email=${encodeURIComponent(emailFromQuery)}&code=${encodeURIComponent(fullCode)}`);
        } else {
          setError("invalid");
        }
      } catch {
        setError("network");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emailFromQuery, router]
  );

  const handleResend = useCallback(async () => {
    if (resending) return;

    setResending(true);
    setError(null);

    try {
      // TODO: Backend integration
      // await resendResetCode(emailFromQuery);
    } catch {
      setError("network");
    } finally {
      setResending(false);
    }
  }, [resending]);

  const handleBack = useCallback(() => {
    router.push("/forgot-password");
  }, [router]);

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
          {/* Icon + Title + Subtitle */}
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 tracking-tight">
              {t("verifyCodeTitle")}
            </h1>

            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-[280px] mx-auto">
              {t("verifyCodeSubtitle")}
            </p>

            {emailFromQuery && (
              <p className="text-xs sm:text-sm text-gray-600 mt-2 font-medium">
                {t("weSentCodeTo")}{" "}
                <span className="text-primary font-semibold">{emailFromQuery}</span>
              </p>
            )}
          </div>

          {/* Form */}
          <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-5">
            {/* OTP Input */}
            <div className="space-y-3">
              <label htmlFor="otp-input-group" className="sr-only">
                {t("enterVerificationCode")}
              </label>
              <OTPInput
                id="otp-input-group"
                length={6}
                onChange={setOtpCode}
                onComplete={handleOtpComplete}
                error={error !== null}
                disabled={loading}
                ariaLabel={t("enterVerificationCode")}
                className="w-full"
              />
            </div>

            {/* Error Message */}
            <ErrorMessageComponent type={error} t={t} />

            {/* Verify Button */}
            <button
              type="submit"
              onClick={() => handleOtpComplete(otpCode)}
              disabled={loading || otpCode.length !== 6 || resending}
              className={cn(
                "w-full py-3 px-4 rounded-xl font-semibold text-sm",
                "bg-gradient-to-r from-primary to-primary-container text-on-primary",
                "shadow-lg shadow-primary/20",
                "hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5",
                "active:translate-y-0 active:shadow-lg",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2",
                "transition-all duration-200",
                "flex items-center justify-center gap-2",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg",
                "mt-2"
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
                  {t("verifying")}
                </>
              ) : (
                t("verifyCode")
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

          {/* Resend Section */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500 mb-2">
              {t("didnReceiveCode")}
            </p>
            <div className="flex items-center justify-center gap-2">
              {loading ? (
                <ResendTimer />
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className={cn(
                    "text-sm font-semibold transition-all duration-200",
                    "text-primary hover:text-primary/80 active:text-primary/60",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 rounded",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-primary",
                    resending && "pointer-events-none"
                  )}
                >
                  {resending ? (
                    <span className="inline-flex items-center gap-1.5">
                      <svg
                        className="w-4 h-4 animate-spin"
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
                      {t("resending")}
                    </span>
                  ) : (
                    t("resendCode")
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-6 text-center">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            {t("backToSignIn")}
          </Link>
        </div>
      </div>
    </div>
  );
}