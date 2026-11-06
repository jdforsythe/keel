/** `decodeURIComponent` that keeps the text as is when it is not valid percent-encoding. */
export function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
