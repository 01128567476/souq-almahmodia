/**
 * Production logger — structured, minimal, environment-aware.
 *
 * - Development: logs errors + warnings only
 * - Production: errors only (no debug noise)
 * - All logs include timestamp + service prefix
 */

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === "production" ? "error" : "debug";

function formatEntry(entry: LogEntry): string {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${entry.level.toUpperCase()}] ${entry.message}`;
  if (entry.meta) {
    return `${base} ${JSON.stringify(entry.meta)}`;
  }
  return base;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] > LEVEL_ORDER[MIN_LEVEL]) return;

  const entry = { level, message, meta };
  const formatted = formatEntry(entry);

  switch (level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "info":
      // In production, suppress info logs
      if (process.env.NODE_ENV !== "production") {
        console.info(formatted);
      }
      break;
    case "debug":
      // Only in development
      if (process.env.NODE_ENV !== "production") {
        console.log(formatted);
      }
      break;
  }
}

export const logger = {
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),

  /** Log an error and return safe fallback */
  tryCatch: <T>(fn: () => T, fallback: T, message = "Operation failed"): T => {
    try {
      return fn();
    } catch (err) {
      logger.error(message, { error: err instanceof Error ? err.message : String(err) });
      return fallback;
    }
  },
};

/** Convenience: log-only if development, silent in production */
export function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}