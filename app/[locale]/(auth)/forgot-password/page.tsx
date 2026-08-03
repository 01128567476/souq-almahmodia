/**
 * Forgot Password Page
 * 
 * Step 1: Enter email -> Navigate to /verify-code
 */

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { cn } from "@/utils/cn";
import { validateEmail } from "@/lib/authValidation";
import { forgotPassword } from "@/services/authAPI";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");

  const Logo = () => (
    <div className="flex justify-center mb-6 sm:mb-8">
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-lg shadow-primary/20">
        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </div>
    </div>
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }

    setLoading(true);
    
    try {
      const result = await forgotPassword({ email });
      
      if (result.success) {
        router.push(`/verify-code?email=${encodeURIComponent(email)}`);
      } else {
        setErrors({ email: result.message || t("requiredField") });
      }
    } catch {
      setErrors({ email: t("serverError") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:px-12">
      <div className="w-full max-w-[420px]">
        <Logo />

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 px-5 py-6 sm:px-6 sm:py-8 md:px-8 md:py-8">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 tracking-tight">
              {t("forgotPasswordTitle")}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-[280px] mx-auto">
              {t("forgotPasswordSubtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="forgotEmail" className="block text-sm font-medium text-gray-700 ml-1">
                {t("email")}
                <span className="text-red-500 ms-1">*</span>
              </label>
              <input
                id="forgotEmail"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                }}
                placeholder="name@example.com"
                autoComplete="email"
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
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t("sending")}
                </>
              ) : (
                t("sendCodeButton")
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <Link
              href="/"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {t("backToSignIn")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}