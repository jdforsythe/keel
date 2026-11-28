import type { IncomingMessage } from "node:http";

/** A node request as a web `Request` at `url`, its body read whole. */
export async function webRequest(req: IncomingMessage, url: string): Promise<Request> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined || k.startsWith(":")) continue;
    for (const one of Array.isArray(v) ? v : [v]) headers.append(k, one);
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)));
  const method = req.method ?? "GET";
  const body = method === "GET" || method === "HEAD" || chunks.length === 0 ? undefined : Buffer.concat(chunks);
  return new Request(url, { method, headers, ...(body === undefined ? {} : { body }) });
}
