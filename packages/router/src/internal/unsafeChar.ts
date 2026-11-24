/** Whether `text` holds a backslash (a URL parser reads it as `/`) or a control character: C0, DEL or C1. */
export function unsafeChar(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x5c) return true;
  }
  return false;
}
