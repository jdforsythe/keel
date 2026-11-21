import { isBlank } from "@keel/schema/internal";

const CONTROL = /[\p{Cc}\p{Cf}\u2028\u2029]/u;

/**
 * Whether `value` is a declared origin's reason (k.origins Declaration): 1 to 200 characters, one visible by the blank
 * set of `@keel/schema` (`isBlank`), and none a control or format character or a line or paragraph separator (so no
 * line break, NUL, tab or bidirectional override).
 */
export function isOriginReason(value: string): boolean {
  const n = [...value].length;
  return n >= 1 && n <= 200 && !CONTROL.test(value) && !isBlank(value);
}
