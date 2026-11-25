import type { KeelError, Result } from "@keel/schema";

/** The value of an answer a test needs to have succeeded; a refusal fails the test with its code and message. */
export function must<T>(answer: Result<T, KeelError<string, unknown>>): T {
  if (!answer.ok) throw new Error(`${answer.error.code}: ${answer.error.message}`);
  return answer.value;
}
