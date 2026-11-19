const encoder = new TextEncoder();

/** The UTF-8 byte length of `text`. */
export function utf8Length(text: string): number {
  return encoder.encode(text).length;
}
