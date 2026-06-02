export type ConsoleLogEntry = {
  level: "log" | "warn" | "error";
  message: string;
  createdAt: string;
};

const MAX_LOGS = 200;
const logs: ConsoleLogEntry[] = [];

export function sanitizeLogMessage(value: unknown) {
  return String(value)
    .replace(/data:[^\s]+base64,[^\s]+/giu, "[base64-redacted]")
    .replace(/password[^\s]*/giu, "[secret-redacted]")
    .slice(0, 2_000);
}

export function pushConsoleLog(level: ConsoleLogEntry["level"], message: unknown) {
  logs.push({ level, message: sanitizeLogMessage(message), createdAt: new Date().toISOString() });

  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

export function getConsoleLogs() {
  return [...logs];
}
