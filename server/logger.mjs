import winston from "winston";
import { sanitizeLogMeta, SENSITIVE_LOG_KEYS } from "./logMeta.mjs";

const redact = winston.format((info) => {
  const authHeader = info.authorization ?? info.Authorization;
  if (authHeader) {
    info.authorization = "[redacted]";
    delete info.Authorization;
  }
  if (info.body && typeof info.body === "object") {
    const b = { ...info.body };
    for (const k of Object.keys(b)) {
      if (SENSITIVE_LOG_KEYS.has(k.toLowerCase())) {
        b[k] = "[redacted]";
      }
    }
    info.body = b;
  }
  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    redact(),
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const safeMeta = sanitizeLogMeta(meta);
      const rest = Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : "";
      return `${timestamp} [${level}] ${message}${rest}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});
