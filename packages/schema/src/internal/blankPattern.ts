/**
 * The JSON Schema `pattern` of a `string` with `min` >= 1: a negated class of `\uXXXX` ranges holding the blank set's
 * characters below U+10000 other than `M` and `Cs` (`isBlank`), from Unicode 17 tables. ECMA-262, with or without the
 * `u` flag, and Python `re` read it alike; an astral character matches it as one code point or as two surrogates. It
 * is a necessary condition only: `parse` decides.
 */
export const blankPattern =
  "[^\\u0000-\\u0020\\u007F-\\u00A0\\u00AD\\u0600-\\u0605\\u061C\\u06DD\\u070F\\u0890-\\u0891\\u08E2\\u115F-\\u1160\\u1680\\u180E\\u2000-\\u200F\\u2028-\\u202F\\u205F-\\u206F\\u2800\\u3000\\u3164\\uFEFF\\uFFA0\\uFFF0-\\uFFFB]";
