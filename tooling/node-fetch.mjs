// Preloaded into each vitest worker process (`--import`, through keelConfig) before any test environment runs: it
// keeps Node's fetch classes under one `globalThis` key, which node-fetch-setup.ts puts back once happy-dom has
// replaced the globals (k.mount Testing). The DOM's `FormData` stays happy-dom's (it reads a form element), so the
// `Request`, `Response` and `fetch` kept here take one as a body, as a browser's do: its entries are copied into a
// Node `FormData` first, a file entry with the bytes happy-dom holds for it.
const KEY = Symbol.for("keel.nodeFetch");

const NodeFormData = globalThis.FormData;
const NodeFile = globalThis.File;

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

/** A Node `FormData` with the entries of `form`. */
const nodeForm = (form) => {
  const out = new NodeFormData();
  for (const [name, value] of form.entries()) {
    if (typeof value === "string") out.append(name, value);
    else
      out.append(
        name,
        new NodeFile([bytesOf(value)], value.name, { type: value.type, lastModified: value.lastModified }),
      );
  }
  return out;
};

const bodyOf = (init) =>
  init !== null && typeof init === "object" && isForeignForm(init.body) ? { ...init, body: nodeForm(init.body) } : init;

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
    super(isForeignForm(body) ? nodeForm(body) : body, init);
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
