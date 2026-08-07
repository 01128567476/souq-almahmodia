/**
 * Authentication validation utilities.
 * Backend-ready validation functions used by all auth forms.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/** Validate email format */
export function validateEmail(email: string): string | null {
  if (!email.trim()) return "requiredField";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "invalidEmail";
  return null;
}

/**
 * Validate password strength — Production Requirements
 *
 * Rules:
 * - Minimum 8 characters
 * - Maximum 128 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 *
 * This validator is used ONLY for password creation flows:
 * - Register
 * - Reset Password
 * - Change Password
 */
export function validatePassword(password: string): string | null {
  if (!password) return "requiredField";
  if (password.length < 8) return "passwordMinLength";
  if (password.length > 128) return "passwordMaxLength";
  if (!/[A-Z]/.test(password)) return "passwordUppercase";
  if (!/[a-z]/.test(password)) return "passwordLowercase";
  if (!/[0-9]/.test(password)) return "passwordNumber";
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return "passwordSpecial";
  return null;
}

/** Validate password confirmation */
export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return "requiredField";
  if (password !== confirm) return "passwordMismatch";
  return null;
}

/** Validate phone number format */
export function validatePhone(phone: string): string | null {
  if (!phone.trim()) return "requiredField";
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
  if (!phoneRegex.test(phone.replace(/[\s-]/g, ""))) return "invalidPhone";
  return null;
}

/** Validate username */
export function validateUsername(username: string): string | null {
  if (!username.trim()) return "requiredField";
  if (username.length < 3) return "usernameMinLength";
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) return "usernameInvalid";
  return null;
}

/** Validate full name */
export function validateFullName(name: string): string | null {
  if (!name.trim()) return "requiredField";
  if (name.length < 2) return "nameMinLength";
  return null;
}

/** Validate entire register form */
export function validateRegisterForm(data: {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}): ValidationResult {
  const errors: Record<string, string> = {};

  const fullNameError = validateFullName(data.fullName);
  if (fullNameError) errors.fullName = fullNameError;

  const usernameError = validateUsername(data.username);
  if (usernameError) errors.username = usernameError;

  const emailError = validateEmail(data.email);
  if (emailError) errors.email = emailError;

  const phoneError = validatePhone(data.phone);
  if (phoneError) errors.phone = phoneError;

  const passwordError = validatePassword(data.password);
  if (passwordError) errors.password = passwordError;

  const confirmError = validateConfirmPassword(data.password, data.confirmPassword);
  if (confirmError) errors.confirmPassword = confirmError;

  if (!data.agreeTerms) {
    errors.agreeTerms = "agreeTermsRequired";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/** Validate entire login form */
export function validateLoginForm(data: {
  email: string;
  password: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  const emailError = validateEmail(data.email);
  if (emailError) errors.email = emailError;

  if (!data.password) errors.password = "requiredField";

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/** Password strength indicator */
export interface PasswordStrength {
  score: number;
  label: "weak" | "fair" | "good" | "strong";
  color: string;
}

export function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: "weak", color: "bg-red-500" };
  if (score <= 3) return { score, label: "fair", color: "bg-yellow-500" };
  if (score <= 4) return { score, label: "good", color: "bg-blue-500" };
  return { score, label: "strong", color: "bg-green-500" };
}