import { STATUS_CODES } from "node:http";
import type { Duplex } from "node:stream";
import { startRefusal } from "./startRefusal.ts";

/**
 * Answer on `socket` a request the HTTP parser rejected (`clientError`: conflicting `Content-Length` and
 * `Transfer-Encoding`, an unknown method, a bad version, a NUL in a header) with no handler run (k.security Headers):
 * 400 with the k.security headers, or Node's own 431 for headers too large and 408 for a request that timed out, then
 * the connection closes. A socket already written to, or no longer writable, is destroyed.
 */
export function parserRefusal(code: string | undefined, socket: Duplex, https: boolean): void {
  if (!socket.writable || ("bytesWritten" in socket && socket.bytesWritten !== 0)) {
    socket.destroy();
    return;
  }
  const status = code === "HPE_HEADER_OVERFLOW" ? 431 : code === "ERR_HTTP_REQUEST_TIMEOUT" ? 408 : 400;
  const r = startRefusal(new Response(null, { status }), https);
  const head = [...r.headers].map(([k, v]) => `${k}: ${v}\r\n`).join("");
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ""}\r\n${head}content-length: 0\r\nconnection: close\r\n\r\n`,
  );
}
