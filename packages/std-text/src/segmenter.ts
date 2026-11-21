/**
 * The one grapheme segmenter (std.text). The tag is fixed so the host locale is never read; grapheme boundaries
 * (UAX #29) are the same in every locale.
 */
export const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
