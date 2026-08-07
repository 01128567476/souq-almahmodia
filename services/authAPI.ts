/**
 * Authentication API Service
 *
 * This service delegates to the Next.js API routes:
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - POST /api/auth/logout
 *
 * All logic lives in the API routes. This file provides
 * a convenient client-side interface for components.
 *
 * No mock data. No temporary code. No compatibility hacks.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface RegisterRequest {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
}

export interface RegisterResponse {
  success: boolean;
  userId?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  userId?: string;
  message?: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Generic fetch wrapper with error handling. */
async function fetchAPI<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    method: options.method ?? "GET",
    body: options.body,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/* Auth API                                                            */
/* ------------------------------------------------------------------ */

/**
 * Register a new user.
 * Sets session cookie automatically on success.
 */
export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  return fetchAPI<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Login with email and password.
 * Sets session cookie automatically on success.
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  return fetchAPI<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Logout — revokes the current session and clears the cookie.
 */
export async function logout(): Promise<{ success: boolean }> {
  return fetchAPI<{ success: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

/* ------------------------------------------------------------------ */
/* Placeholder stubs — features not yet implemented                   */
/* These functions are imported by existing pages but the features    */
/* (   OTP, password reset, email verification) are deferred to later */
/* phases. They return a 501 error to indicate the feature is not     */
/* yet available.                                                     */
/* ------------------------------------------------------------------ */

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message?: string;
}

/**
 * NOT IMPLEMENTED — OTP/Password reset is deferred.
 * Existing pages import this function but it will return 501.
 */
export async function forgotPassword(data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  return fetchAPI<ForgotPasswordResponse>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message?: string;
}

/**
 * NOT IMPLEMENTED — Password reset is deferred.
 */
export async function resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  return fetchAPI<ResetPasswordResponse>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

export interface VerifyResetCodeResponse {
  success: boolean;
  message?: string;
}

/**
 * NOT IMPLEMENTED — OTP verification is deferred.
 * Accepts (email, code) as separate args (matching verify-code page call signature).
 */
export async function verifyResetCode(data: VerifyResetCodeRequest): Promise<VerifyResetCodeResponse> {
  return fetchAPI<VerifyResetCodeResponse>("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/* ------------------------------------------------------------------ */
/* Registration OTP verification                                       */
/* ------------------------------------------------------------------ */

export interface VerifyRegistrationRequest {
  email: string;
  otp: string;
}

export interface VerifyRegistrationResponse {
  success: boolean;
  message?: string;
}

/**
 * Verify OTP code for newly registered user.
 * Sets emailVerified=true and returns success.
 */
export async function verifyRegistration(data: VerifyRegistrationRequest): Promise<VerifyRegistrationResponse> {
  return fetchAPI<VerifyRegistrationResponse>("/api/auth/verify-registration", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/* ----------------------------------------------------------------                                              -- */
/* Set / Change Password */
/* ------------------------------------------------------------------ */

export interface SetPasswordRequest {
  currentPassword?: string;
  newPassword: string;
}

export interface SetPasswordResponse {
  success: boolean;
  message?: string;
}

/**
 * Create or change website password for authenticated user.
 * Google-only users use this to add email/password login.
 * Existing password users use this to change their password.
 */
export async function setPassword(data: SetPasswordRequest): Promise<SetPasswordResponse> {
  return fetchAPI<SetPasswordResponse>("/api/auth/set-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}