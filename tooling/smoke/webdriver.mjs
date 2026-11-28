// A WebDriver client of the few W3C commands tooling/smoke/shell.mjs needs, over HTTP with fetch. Every command has a
// time limit; a WebDriver error rejects with its `error` and `message`.

import { testTime } from "../test-time.ts";

const ELEMENT = "element-6066-11e4-a07c-4bf9f9a6f5c5";

/** The id of an element reference: the W3C key, else the one key a driver gave it. */
const elementId = (h) => {
  const values = typeof h === "object" && h !== null ? Object.values(h) : [];
  return String(h?.[ELEMENT] ?? (values.length === 1 ? values[0] : ""));
};

/** A WebDriver error answer as an Error whose `code` is the protocol's `error` (`no such element`, ...). */
const failure = (method, path, status, value) =>
  Object.assign(new Error(`${method} ${path} ${status} ${value?.error ?? ""} ${value?.message ?? ""}`.trim()), {
    code: value?.error ?? `http ${status}`,
  });

/** One command against the driver at `base`; resolves to the answer's `value`. */
async function command(base, method, path, body, ms) {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  const answer = await r.json().catch(() => null);
  const value = answer?.value;
  if (!r.ok || (typeof value === "object" && value !== null && typeof value.error === "string"))
    throw failure(method, path, r.status, value);
  return value;
}

/**
 * Open a session on the driver at `base` (`http://127.0.0.1:<port>`) with `capabilities` as `alwaysMatch`. The
 * session's methods: `url()`, `navigate(url)`, `find(css)` (an element handle, or rejects `no such element`),
 * `click(el)`, `clear(el)`, `type(el, text)`, `execute(script, args)` and `quit()`.
 */
export async function openSession(
  base,
  capabilities,
  { commandMs = testTime(30_000), startMs = testTime(60_000) } = {},
) {
  const opened = await command(base, "POST", "/session", { capabilities: { alwaysMatch: capabilities } }, startMs);
  const id = String(opened?.sessionId ?? "");
  if (id === "") throw new Error("POST /session answered no sessionId");
  const s = (method, path, body) => command(base, method, `/session/${id}${path}`, body, commandMs);
  const el = (h) => `/element/${encodeURIComponent(elementId(h))}`;
  return {
    id,
    capabilities: opened?.capabilities ?? {},
    url: () => s("GET", "/url"),
    navigate: (url) => s("POST", "/url", { url }),
    find: (css) => s("POST", "/element", { using: "css selector", value: css }),
    click: (h) => s("POST", `${el(h)}/click`, {}),
    clear: (h) => s("POST", `${el(h)}/clear`, {}),
    type: (h, text) => s("POST", `${el(h)}/value`, { text }),
    execute: (script, args = []) => s("POST", "/execute/sync", { script, args }),
    quit: () => command(base, "DELETE", `/session/${id}`, undefined, commandMs),
  };
}

/** True once the driver at `base` answers `GET /status`. */
export const driverReady = (base) =>
  fetch(`${base}/status`, { signal: AbortSignal.timeout(testTime(2_000)) }).then(
    (r) => r.ok,
    () => false,
  );
