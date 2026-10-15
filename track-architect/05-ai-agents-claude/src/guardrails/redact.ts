/** Best-effort, regex-based redaction for logs and outputs. It is NOT a DLP product. */
const RULES: [RegExp, string][] = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/g, "[REDACTED_KEY]"],
  [/Bearer\s+[A-Za-z0-9._~+/-]{10,}/gi, "Bearer [REDACTED_TOKEN]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]"],
  [/\b(?:\+?\d{1,2}[ -]?)?\(?\d{3}\)?[ -]\d{3}[ -]\d{4}\b/g, "[REDACTED_PHONE]"],
  [/\b\d{13,19}\b/g, "[REDACTED_NUMBER]"],
];

export function redact(text: string): string {
  return RULES.reduce((acc, [re, rep]) => acc.replace(re, rep), text);
}

export type LogFn = (event: string, data?: Record<string, unknown>) => void;

/** Logger that redacts every serialized payload before it reaches the sink. */
export function createLogger(sink: (line: string) => void = () => {}): LogFn {
  return (event, data = {}) => sink(redact(JSON.stringify({ event, ...data })));
}
