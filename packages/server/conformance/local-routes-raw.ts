// Raw-socket helpers for the `server.mjs` conformance files that write requests an HTTP client would not (not a test file). Seed for every property: 1337.
// A request is written as is to a fresh connection and the reply read until the server closes it, so each request carries `Connection: close` or is one the parser rejects.
import net from "node:net";
import { expect } from "vitest";

export const SIX: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), payment=(), usb=()",
};
export const sixHeaders = (headers: Record<string, string>, label: string): void => {
  for (const [name, value] of Object.entries(SIX)) expect(headers[name], `${label}: ${name}`).toBe(value);
};

export type Raw = { status: number; headers: Record<string, string>; body: string };
/** `text` written as is to a fresh connection to `port`; read until the server closes it. */
export const raw = (port: number, text: string): Promise<Raw> =>
  new Promise((resolve, reject) => {
    const sock = net.connect(port, "127.0.0.1");
    const chunks: Buffer[] = [];
    sock.on("data", (c: Buffer) => chunks.push(c));
    sock.on("error", reject);
    sock.on("close", () => {
      const all = Buffer.concat(chunks).toString("utf8");
      const cut = all.indexOf("\r\n\r\n");
      const head = (cut < 0 ? all : all.slice(0, cut)).split("\r\n");
      const headers: Record<string, string> = {};
      for (const line of head.slice(1)) {
        const i = line.indexOf(":");
        if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
      }
      resolve({ status: Number(head[0]?.split(" ")[1] ?? 0), headers, body: cut < 0 ? "" : all.slice(cut + 4) });
    });
    sock.write(text);
  });
