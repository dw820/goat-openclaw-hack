type LogLevel = "debug" | "info" | "warn" | "error";
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT = (process.env.LOG_LEVEL as LogLevel) || "debug";

function log(level: LogLevel, tag: string, msg: string, data?: unknown) {
  if (LEVELS[level] < LEVELS[CURRENT]) return;
  const prefix = `[${tag}] ${level.toUpperCase().padEnd(5)}`;
  if (data !== undefined) {
    console[level === "debug" ? "log" : level](prefix, msg, data);
  } else {
    console[level === "debug" ? "log" : level](prefix, msg);
  }
}

export function createLogger(tag: string) {
  return {
    debug: (msg: string, data?: unknown) => log("debug", tag, msg, data),
    info:  (msg: string, data?: unknown) => log("info",  tag, msg, data),
    warn:  (msg: string, data?: unknown) => log("warn",  tag, msg, data),
    error: (msg: string, data?: unknown) => log("error", tag, msg, data),
  };
}
