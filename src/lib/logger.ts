type LogContext = Record<string, unknown>;

function formatEntry(level: "info" | "error", msg: string, ctx?: LogContext): string {
  return JSON.stringify({ level, msg, ...ctx });
}

export const logger = {
  info:  (msg: string, ctx?: LogContext) => console.log(formatEntry("info", msg, ctx)),
  error: (msg: string, ctx?: LogContext) => console.error(formatEntry("error", msg, ctx)),
};
