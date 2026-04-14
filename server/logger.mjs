import winston from "winston";

const redact = winston.format((info) => {
  if (info.authorization) info.authorization = "[redacted]";
  if (info.body && typeof info.body === "object") {
    const b = { ...info.body };
    for (const k of ["password", "senha", "token", "access_token", "refresh_token", "secret", "apikey", "api_key"]) {
      if (b[k] != null) b[k] = "[redacted]";
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
      const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
      return `${timestamp} [${level}] ${message}${rest}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});
