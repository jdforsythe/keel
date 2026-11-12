import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import type { JsonValue } from "@keel/schema";
import type { Outgoing } from "./Outgoing.ts";
import type { Realm } from "./Realm.ts";
import { field } from "./field.ts";
import { wire } from "./wire.ts";

/**
 * The worker entry beside this file (source `.ts`, or a build's `.js`), run with tsx so workspace sources load. The
 * base is a variable: a bundler rewrites `new URL('<literal>', import.meta.url)` into a served asset URL.
 */
const here = import.meta.url;
const entry = (): URL => new URL(`./userWorker.${here.endsWith(".ts") ? "ts" : "js"}`, here);
const loader = (): string => pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href;

/**
 * Start one user's worker (std.multi) with its DOM at `origin`. Each request its sim net sends to `origin` goes to
 * `fetch`; the response head, every body chunk and the end are posted back in order, and `touch` hears each, so the
 * group's `settle` sees traffic.
 */
export function startRealm(origin: string, fetch: (req: Outgoing) => Promise<Response>, touch: () => void): Realm {
  const worker = new Worker(entry(), { execArgv: ["--import", loader()], workerData: origin });
  const calls = new Map<number, { resolve(v: JsonValue | undefined): void; reject(e: Error): void }>();
  let next = 0;
  let dead: Error | undefined;
  const fail = (error: Error): void => {
    dead ??= error;
    for (const c of calls.values()) c.reject(error);
    calls.clear();
  };

  const serve = async (rid: number, req: Outgoing): Promise<void> => {
    let res: Response;
    try {
      res = await fetch(req);
    } catch (error) {
      touch();
      worker.postMessage({ t: "end", rid, error: error instanceof Error ? error.message : String(error) });
      return;
    }
    touch();
    const headers = [...res.headers].filter(([k]) => k.toLowerCase() !== "set-cookie");
    worker.postMessage({ t: "head", rid, status: res.status, statusText: res.statusText, headers });
    const reader = res.body?.getReader();
    try {
      for (let n = await reader?.read(); n !== undefined && !n.done; n = await reader?.read()) {
        touch();
        worker.postMessage({ t: "chunk", rid, data: n.value });
      }
      touch();
      worker.postMessage({ t: "end", rid });
    } catch (error) {
      touch();
      worker.postMessage({ t: "end", rid, error: error instanceof Error ? error.message : String(error) });
    }
  };

  const onRequest = (m: unknown): void => {
    const r = wire.req.parse(m);
    if (!r.ok) return;
    touch();
    const { rid, method, url } = r.value;
    const headers = new Headers();
    for (const [k, v] of r.value.headers) if (k !== undefined && v !== undefined) headers.append(k, v);
    const body = field(m, "body");
    void serve(rid, { url, method, headers, body: body instanceof Uint8Array ? new Uint8Array(body) : null });
  };

  const onReturn = (m: unknown): void => {
    const r = wire.ret.parse(m);
    if (!r.ok) {
      const id = field(m, "id");
      const c = typeof id === "number" ? calls.get(id) : undefined;
      calls.delete(typeof id === "number" ? id : -1);
      c?.reject(new TypeError(`group: bad answer: ${r.error.message}`));
      return;
    }
    const c = calls.get(r.value.id);
    if (c === undefined) return;
    calls.delete(r.value.id);
    if (r.value.ok) c.resolve(r.value.value);
    else
      c.reject(
        Object.assign(
          new Error(r.value.message ?? "group: call failed"),
          r.value.code === undefined ? {} : { code: r.value.code },
        ),
      );
  };

  worker.on("message", (m: unknown) => {
    const t = field(m, "t");
    if (t === "req") onRequest(m);
    else if (t === "ret") onReturn(m);
  });
  worker.on("error", (e: unknown) => fail(e instanceof Error ? e : new Error(String(e))));
  worker.on("exit", (code: number) => fail(new Error(`group: user worker exited (${code})`)));

  return {
    call: (op, arg) => {
      if (dead !== undefined) return Promise.reject(dead);
      const id = next++;
      return new Promise((resolve, reject) => {
        calls.set(id, { resolve, reject });
        worker.postMessage({ t: "call", id, op, arg });
      });
    },
    terminate: async () => {
      dead ??= new Error("group: stopped");
      await worker.terminate();
    },
  };
}
