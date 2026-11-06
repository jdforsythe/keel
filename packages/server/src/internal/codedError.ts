/** An Error carrying a stable diagnostic code (`E15xx`); the message starts with the code. */
export function codedError(code: string, message: string): Error & { readonly code: string } {
  return Object.assign(new Error(`${code} ${message}`), { code });
}
