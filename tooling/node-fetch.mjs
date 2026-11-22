// Preloaded into each vitest worker process (`--import`, through keelConfig) before any test environment runs: it
// keeps Node's fetch classes under one `globalThis` key, which node-fetch-setup.ts puts back once happy-dom has
// replaced the globals (k.mount Testing). The DOM's `FormData` stays happy-dom's (it reads a form element), so the
// `Request`, `Response` and `fetch` kept here take one as a body, as a browser's do (`multipart`).
const KEY = Symbol.for("keel.nodeFetch");

const NodeFormData = globalThis.FormData;

/** A `FormData` of another realm (happy-dom's), read by shape. */
const isForeignForm = (body) =>
  typeof body === "object" &&
  body !== null &&
  !(body instanceof NodeFormData) &&
  body.constructor?.name === "FormData" &&
  typeof body.entries === "function";

/** The bytes a happy-dom `Blob` holds, under its own `buffer` symbol. */
const bytesOf = (blob) => {
  const at = Object.getOwnPropertySymbols(blob).find((s) => s.description === "buffer");
  const held = at === undefined ? undefined : blob[at];
  if (!(held instanceof Uint8Array)) throw new TypeError("keel test: a FormData file entry whose bytes cannot be read");
  return held;
};

const NodeHeaders = globalThis.Headers;
/** A multipart name or filename, quoted as the HTML form encoding escapes it. */
const quoted = (text) => text.replace(/\r\n|\r|\n/g, "\r\n").replace(/[\r\n"]/g, (c) => encodeURIComponent(c));
let boundaries = 0;
const encoder = new TextEncoder();

/**
 * `form`'s entries as one `multipart/form-data` body, a file entry with the bytes happy-dom holds for it. Bytes, not a
 * Node `FormData`: Node streams a `FormData` body from a generator that throws once a reader cancels it (a server that
 * stops at its body cap); bytes are read in microtasks, as that generator's are, where a `Blob`'s stream waits on I/O.
 */
const multipart = (form) => {
  const boundary = `----keeltest${(++boundaries).toString(16).padStart(8, "0")}`;
  const parts = [];
  for (const [name, value] of form.entries()) {
    if (typeof value === "string") {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${quoted(name)}"\r\n\r\n`);
      parts.push(value.replace(/\r\n|\r|\n/g, "\r\n"), "\r\n");
    } else {
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="${quoted(name)}"; filename="${quoted(value.name)}"\r\n` +
          `Content-Type: ${value.type || "application/octet-stream"}\r\n\r\n`,
      );
      parts.push(bytesOf(value), "\r\n");
    }
  }
  parts.push(`--${boundary}--\r\n`);
  const chunks = parts.map((p) => (typeof p === "string" ? encoder.encode(p) : p));
  const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  return { bytes, type: `multipart/form-data; boundary=${boundary}` };
};

/** `headers` with `content-type` set to `type` unless it names one. */
const typed = (headers, type) => {
  const out = new NodeHeaders(headers);
  if (!out.has("content-type")) out.set("content-type", type);
  return out;
};

const bodyOf = (init) => {
  if (init === null || typeof init !== "object" || !isForeignForm(init.body)) return init;
  const { bytes, type } = multipart(init.body);
  return { ...init, body: bytes, headers: typed(init.headers, type) };
};

// Every Node `Request` or `Response` is one of these (a clone, a fetch's answer), as with the globals they stand for.
const NodeRequest = globalThis.Request;
const NodeResponse = globalThis.Response;
class Request extends NodeRequest {
  constructor(input, init) {
    super(input, bodyOf(init));
  }
  static [Symbol.hasInstance](x) {
    return x instanceof NodeRequest;
  }
}
class Response extends NodeResponse {
  constructor(body, init) {
    if (!isForeignForm(body)) super(body, init);
    else {
      const { bytes, type } = multipart(body);
      super(bytes, { ...init, headers: typed(init?.headers, type) });
    }
  }
  static [Symbol.hasInstance](x) {
    return x instanceof NodeResponse;
  }
}
const nodeFetch = globalThis.fetch;
const fetch = (input, init) => nodeFetch(input, bodyOf(init));

if (globalThis[KEY] === undefined)
  globalThis[KEY] = {
    Request,
    Response,
    Headers: globalThis.Headers,
    fetch,
    AbortController: globalThis.AbortController,
    AbortSignal: globalThis.AbortSignal,
  };

// Node's fetch sets the type of service on each new socket (`socket.setTypeOfService(0)`), and on macOS that throws
// EINVAL from inside the client when the peer has already reset the connection, as a `keel dev` child that is
// starting, reloading or ending does; nothing can catch it, so it ends the worker as an unhandled error. The type of
// service is best effort: here an EINVAL leaves it unset, and the fetch fails or succeeds on its own terms.
const { Socket } = await import("node:net");
const setTypeOfService = Socket.prototype.setTypeOfService;
if (typeof setTypeOfService === "function")
  Socket.prototype.setTypeOfService = function keelSetTypeOfService(tos) {
    try {
      return setTypeOfService.call(this, tos);
    } catch (error) {
      if (error?.code === "EINVAL" || error?.errno === -22) return this;
      throw error;
    }
  };
