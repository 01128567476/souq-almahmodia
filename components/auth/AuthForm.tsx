"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { ROUTES, requiredRoleFor, sanitizeNext } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/utils/cn";
import { signIn } from "next-auth/react";

type Mode = "signin" | "signup";

/** Email validation helper */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Password strength validation — returns error key or null */
function validatePasswordStrength(password: string): string | null {
  if (!password) return "requiredField";
  if (password.length < 8) return "passwordMinLength";
  if (!/[A-Z]/.test(password)) return "passwordUppercase";
  if (!/[a-z]/.test(password)) return "passwordLowercase";
  if (!/[0-9]/.test(password)) return "passwordNumber";
  return null;
}

/** Social provider button component */
function SocialButton({
  provider,
  icon,
  onClick,
}: {
  provider: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-center gap-2 w-full py-3 px-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary active:scale-[0.98]"
      aria-label={`Sign in with ${provider}`}
    >
      <span className="w-5 h-5 flex-shrink-0">{icon}</span>
      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
        {provider}
      </span>
    </button>
  );
}

/** Input field with icon */
function InputField({
  id,
  label,
  icon,
  type = "text",
  placeholder,
  required,
  error,
  rightIcon,
  onRightIconClick,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  type?: string;
  placeholder: string;
  required?: boolean;
  error?: string;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 ml-1"
      >
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
          {icon}
        </span>
        <input
          id={id}
          name={id}
          type={type}
          required={required}
          placeholder={placeholder}
          className={cn(
            "w-full pl-11 pr-12 py-3 bg-white border border-gray-200 rounded-xl",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
            "transition-all duration-200",
            "text-sm text-gray-900 placeholder-gray-400",
            error && "border-red-300 focus:border-red-500 focus:ring-red-100"
          )}
        />
        {rightIcon && (
          <button
            type="button"
            onClick={onRightIconClick}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            {rightIcon}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 ml-1 animate-in fade-in slide-in-from-top-1">{error}</p>
      )}
    </div>
  );
}

export function AuthForm({
  initialMode = "signin",
  next: nextProp,
  locale: localeProp,
}: {
  initialMode?: Mode;
  /** Post-login destination, read from the `?next=` param by the server page. */
  next?: string;
  /** Locale prefix for redirect (e.g. "ar", "en"). */
  locale?: string;
}) {
  const locale = localeProp ?? "ar";
  const t = useTranslations("auth");
  const { login, register: registerUser } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  // Unverified user state
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const next = sanitizeNext(nextProp);
  const [redirecting, setRedirecting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});
    setLoading(true);

    // Client-side validation
    const newErrors: Record<string, string> = {};
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email")?.toString() || "";
    const password = formData.get("password")?.toString() || "";

    if (!email) {
      newErrors.email = t("requiredField");
    } else if (!isValidEmail(email)) {
      newErrors.email = t("invalidEmail");
    }

    // NOTE: Password strength rules apply ONLY to password creation.
    // Login is authentication only — accept any non-empty password.
    if (mode === "signup") {
      const pwError = validatePasswordStrength(password);
      if (pwError && pwError !== "requiredField") {
        newErrors.password = t(pwError);
      } else if (!password) {
        newErrors.password = t("requiredField");
      }
    } else {
      if (!password) {
        newErrors.password = t("requiredField");
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      if (mode === "signup") {
        // Step 1: Register the user with full registration data
        const fullName = formData.get("name")?.toString() || "";
        const phone = formData.get("phone")?.toString() || "";

        await registerUser({
          fullName,
          email,
          phone: phone || undefined,
          password,
        });

        // Step 2: Redirect to OTP verification page
        // After successful registration, user must verify their email via OTP
        setRedirecting(true);
        window.location.href = `/${locale}/verify-code`;
      } else {
        // Sign in flow
        await login(email, password);

        // Step 2: Fetch fresh session to get the actual role (avoid race condition)
        const sessionResponse = await fetch("/api/auth/session", {
          credentials: "include",
        });

        if (!sessionResponse.ok) {
          throw new Error("Failed to fetch session after login");
        }

        const sessionData = await sessionResponse.json();
        const sessionUser = sessionData?.data?.user;

        if (!sessionUser?.role) {
          throw new Error("Role missing in session after login");
        }

        // Step 3: Redirect based on ACTUAL role from server
        setRedirecting(true);

        if (sessionUser.role === "admin") {
          window.location.href = `/${locale}/dashboard`;
        } else {
          window.location.href = `/${locale}/account`;
        }
      }
    } catch (err: any) {
      // Check if user needs email verification (status 403)
      const responseData = err?.response?.data || {};
      
      if (responseData.needsVerification) {
        setUnverifiedEmail(responseData.email || email);
        setErrors({ 
          form: responseData.message || "Your email address has not been verified. Please check your inbox." 
        });
      } else {
        const errorMessage = err?.message || t(mode === "signup" ? "registerError" : "loginError") || (mode === "signup" ? "Registration failed. Please try again." : "Login failed. Please try again.");
        setErrors({ form: errorMessage });
      }
      setLoading(false);
    }
  };

  /** Handle resend verification code */
  const handleResendVerification = async () => {
    if (!unverifiedEmail || resendCooldown > 0) return;
    
    setResendLoading(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setErrors({ 
          form: `Verification code sent to ${unverifiedEmail}. Please check your inbox.` 
        });
        setResendCooldown(60);
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setErrors({ form: data.message || "Failed to resend verification code." });
      }
    } catch {
      setErrors({ form: "Failed to resend verification code." });
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading("google");
    const requested = next ?? ROUTES.account;
    await signIn("google", { callbackUrl: requested });
  };

  const handleAppleSignIn = async () => {
    setOauthLoading("apple");
    console.log("Apple OAuth not yet configured");
  };

  // Google SVG icon
  const googleIcon = (
    <svg className="w-5 h-5" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );

  // Apple SVG icon
  const appleIcon = (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );

  // Eye icons
  const visibilityIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
  const visibilityOffIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );

  // Mail icon
  const mailIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );

  // Lock icon
  const lockIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );

  // Person icon
  const personIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );

  // At icon (for username)
  const atIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 11-8 0 4 4 0 018 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
    </svg>
  );

  // Phone icon
  const phoneIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );

  return (
    <div className="w-full max-w-[420px] mx-auto">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-lg shadow-primary/20">
          <svg className="w-8 h-8 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {mode === "signin" ? t("signInTitle") : t("signUpTitle")}
        </h1>
        <p className="text-sm text-gray-500">
          {mode === "signin" ? t("signInSubtitle") : t("signUpSubtitle")}
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex p-1 bg-gray-100 rounded-xl mb-8">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={cn(
            "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
            mode === "signin"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {t("signIn")}
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={cn(
            "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
            mode === "signup"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {t("signUp")}
        </button>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="space-y-5">
        {mode === "signup" && (
          <>
            <InputField
              id="name"
              label={t("fullName")}
              icon={personIcon}
              type="text"
              placeholder="Nour Ali"
              required
              error={errors.name}
            />
            <InputField
              id="phone"
              label={t("phone")}
              icon={phoneIcon}
              type="tel"
              placeholder="+20 123 456 7890"
              error={errors.phone}
            />
          </>
        )}
        
        <InputField
          id="email"
          label={t("email")}
          icon={mailIcon}
          type="email"
          placeholder="name@example.com"
          required
          error={errors.email}
        />

        <div>
          <InputField
            id="password"
            label={t("password")}
            icon={lockIcon}
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            required
            error={errors.password}
            rightIcon={showPassword ? visibilityOffIcon : visibilityIcon}
            onRightIconClick={() => setShowPassword((s) => !s)}
          />
          {mode === "signin" && (
            <div className="flex justify-end mt-2">
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {t("forgotPassword")}?
              </Link>
            </div>
          )}
        </div>

        {mode === "signin" && (
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 transition-all"
            />
            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
              {t("rememberDevice")}
            </span>
          </label>
        )}

        {mode === "signup" && (
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              required
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary/20 transition-all"
            />
            <label className="text-sm text-gray-600 leading-relaxed">
              {t.rich("agreeTerms", {
                terms: (c) => (
                  <Link href={ROUTES.terms} className="text-primary hover:underline font-medium">
                    {c}
                  </Link>
                ),
                privacy: (c) => (
                  <Link href={ROUTES.privacy} className="text-primary hover:underline font-medium">
                    {c}
                  </Link>
                ),
              })}
            </label>
          </div>
        )}

        {/* Unverified user banner */}
        {unverifiedEmail && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-amber-800 font-medium mb-1">
                  Email not verified
                </p>
                <p className="text-xs text-amber-700 mb-2">
                  A verification code was sent to {unverifiedEmail}
                </p>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading || resendCooldown > 0}
                  className="text-sm font-medium text-amber-600 hover:text-amber-700 disabled:text-amber-400 disabled:cursor-not-allowed transition-colors"
                >
                  {resendCooldown > 0
                    ? `Resend code (${resendCooldown}s)`
                    : resendLoading
                    ? "Sending..."
                    : "Resend verification code"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global error message */}
        {errors.form && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 animate-in fade-in slide-in-from-top-2">
            {errors.form}
          </div>
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
              {mode === "signin" ? t("signIn") : t("signUp")}...
            </>
          ) : (
            mode === "signin" ? t("signIn") : t("signUp")
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {t("orContinueWith")}
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Social Login */}
      <div className="grid grid-cols-2 gap-3">
        <SocialButton
          provider="Google"
          icon={googleIcon}
          onClick={handleGoogleSignIn}
        />
        <SocialButton
          provider="Apple"
          icon={appleIcon}
          onClick={handleAppleSignIn}
        />
      </div>

      {/* Footer Link */}
      {mode === "signin" ? (
        <p className="text-center text-sm text-gray-500 mt-8">
          {t("noAccount")}{" "}
          <button
            type="button"
            onClick={() => setMode("signup")}
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {t("signUp")}
          </button>
        </p>
      ) : (
        <p className="text-center text-sm text-gray-500 mt-8">
          {t("haveAccount")}{" "}
          <button
            type="button"
            onClick={() => setMode("signin")}
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {t("signIn")}
          </button>
        </p>
      )}
    </div>
  );
}