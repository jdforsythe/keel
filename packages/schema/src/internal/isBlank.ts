const FILLED = /[^\p{space}\p{DI}\p{Cc}\p{Cf}\p{Cs}\p{M}\u2800]/u;

/**
 * True when `text` has no character outside `White_Space`, `Default_Ignorable_Code_Point`, the general categories
 * `Cc`, `Cf`, `Cs` and `M`, and U+2800: the blank set of rule `required`, read from the engine's Unicode tables.
 */
export function isBlank(text: string): boolean {
  return !FILLED.test(text);
}
