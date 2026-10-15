import { redact } from "./redact";

export const MAX_QUESTION_CHARS = 2000;
export const MAX_ANSWER_CHARS = 8000;

export class GuardrailError extends Error {}

export function validateInput(question: unknown): string {
  if (typeof question !== "string") throw new GuardrailError("Question must be a string.");
  const q = question.trim();
  if (!q) throw new GuardrailError("Question must not be empty.");
  if (q.length > MAX_QUESTION_CHARS) throw new GuardrailError(`Question exceeds ${MAX_QUESTION_CHARS} characters.`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(q)) throw new GuardrailError("Question contains control characters.");
  return q;
}

export function validateOutput(answer: string): string {
  const a = redact(answer.trim());
  if (!a) return "The agent produced no answer.";
  return a.length > MAX_ANSWER_CHARS ? a.slice(0, MAX_ANSWER_CHARS) + " [truncated]" : a;
}

/** Heuristic only: used to log a warning, never as the primary defense. */
export function looksLikeInjection(text: string): boolean {
  return /ignore (all |any )?(previous|prior) instructions|reveal .*system prompt/i.test(text);
}
