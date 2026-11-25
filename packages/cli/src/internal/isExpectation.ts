/**
 * A negative type test's expectation (k.unsafe): comment text that, leading white space aside, starts
 * `@ts-expect-error`, then white space, then a description holding a letter.
 */
export function isExpectation(comment: string): boolean {
  return /^\s*@ts-expect-error\s[\s\S]*\p{L}/u.test(comment);
}
