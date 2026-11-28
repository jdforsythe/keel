/** The UTF-8 bytes of `v`, a lone surrogate as the 3 of U+FFFD, in one pass and no allocation. */
export function utf8Bytes(v: string): number {
  let n = 0;
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && (v.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}
