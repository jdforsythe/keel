import type { ServerResponse } from "node:http";

/** Writes a web `Response` to a node response. */
export async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string | string[]> = {};
  for (const [k, v] of response.headers) {
    if (k === "content-length" || k === "content-encoding" || k === "transfer-encoding") continue;
    headers[k] = k === "set-cookie" ? response.headers.getSetCookie() : v;
  }
  const body = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, { ...headers, "content-length": String(body.length) });
  res.end(body);
}
