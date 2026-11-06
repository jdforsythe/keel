/** One LSP base-protocol frame: `Content-Length` (in UTF-8 bytes) header, blank line, JSON body. */
export function frameLsp(message: unknown): string {
  const body = JSON.stringify(message);
  return `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n${body}`;
}
