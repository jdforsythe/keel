// @vitest-environment happy-dom
// Spec: k.serverlog, clause "An action throwing an `Error` whose message is 1,000,000 `a`, and a runner rejecting with it, log in compact and json a `diag` whose message is its first 2,048 characters then `…+<n>`, `n` the characters left out; every json line parses."
// Spec: k.serverlog, clause "A request for a 5,000-character path logs a `req` path of its first 2,048 characters then `…+2952`, in compact and json."
// Spec: k.serverlog, clause "An action that reveals a secret and throws 2,000,001 characters logs `action <id> threw: [secret]`; with no secret or `.pii()` value it logs the first 2,048 characters then `…+<n>`."
// Spec: k.serverlog, clause "For a thrown message of 1,000,000 `\"`, U+20AC or U+0001, every logged line is at most 8,192 characters and 12,288 bytes of UTF-8."
// Seed 1337 (no random input: every case is a fixed large text, built once per file).
import { fixedTime } from "@keel/tooling/test-time";
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { reveal, s } from "@keel/schema";
import { topology } from "@keel/server";
import { describe, expect, it } from "vitest";
import { Params, SEED, createApp, post } from "./fixtures.ts";
import { createAppLoose, flush, pageManifest } from "./topology-fixtures.ts";

type Mode = "dev" | "production";
type Format = "compact" | "json";
const modes: readonly Mode[] = ["dev", "production"];
const formats: readonly Format[] = ["compact", "json"];

const A_MILLION = "a".repeat(1_000_000);
const OVER_CAP = "a".repeat(2_000_001);
const LONG_PATH = `/${"p".repeat(4_999)}`;
const MARK = "…";

const record = (line: string): ReadonlyMap<string, unknown> => {
  const v: unknown = JSON.parse(line);
  return new Map(typeof v === "object" && v !== null ? Object.entries(v) : []);
};
const isReq = (line: string): boolean => /^[A-Z]+ \//.test(line);
/** The messages of the `diag` records among `lines`. */
const messages = (format: Format, lines: readonly string[]): string[] => {
  const out: string[] = [];
  for (const line of lines) {
    if (format === "json") {
      const r = record(line);
      const m = r.get("message");
      if (r.get("kind") === "diag" && typeof m === "string") out.push(m);
    } else if (!isReq(line)) out.push(line.slice(line.indexOf(" ") + 1));
  }
  return out;
};
/** The one message that carries a cut marker. */
const cutMessage = (format: Format, lines: readonly string[]): string => {
  const cut = messages(format, lines).filter((m) => m.includes(MARK));
  expect(cut).toHaveLength(1);
  return cut[0] ?? "";
};
/** A head of 2,048 characters, the marker, and `n` for a text of `total` `a` after a prefix without `a` at its end. */
const expectCutOfAs = (message: string, total: number): void => {
  const at = message.lastIndexOf(MARK);
  const head = message.slice(0, at);
  expect(head).toHaveLength(2_048);
  const run = (/a+$/.exec(head) ?? [""])[0].length;
  expect(run).toBeGreaterThan(1_800);
  expect(message.slice(at)).toBe(`${MARK}+${total - run}`);
};

type Thrower = (secret: () => string) => unknown;
async function throwFromAction(mode: Mode, format: Format, withSecret: boolean, make: Thrower): Promise<string[]> {
  const lines: string[] = [];
  const ordersContract = contract("orders", { "orders.show": { path: "/orders/:kind", params: Params } });
  const save = withSecret
    ? action(ordersContract, "orders.show", { input: s.object({ k: s.secret(s.string()) }) }, (input) =>
        Promise.reject(make(() => reveal(input.k))),
      )
    : action(ordersContract, "orders.show", { input: s.object({}) }, () => Promise.reject(make(() => "")));
  const routes = manifest(ordersContract, {
    "orders.show": { component: () => document.createElement("main"), POST: save },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format, write: (l: string) => void lines.push(l) },
  });
  const res = await app.fetch(
    post("/orders/open", withSecret ? { k: "tok-7f3a9c" } : {}, { accept: "application/json" }),
  );
  await res.text();
  return lines;
}
async function rejectFromRunner(mode: Mode, format: Format, thrown: unknown): Promise<string[]> {
  const lines: string[] = [];
  const run = (_ctx: unknown, signal: AbortSignal): Promise<void> => {
    if (!signal.aborted && lines.length === 0) return Promise.reject(thrown);
    return new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
  };
  const app = await createAppLoose({
    topology: topology({ x: { modules: ["a"], adapter: "node" } }),
    routes: pageManifest("a", "/a", "A"),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format, write: (l: string) => void lines.push(l) },
    runners: { a: [{ run }] },
  });
  await flush();
  await app.close?.();
  return lines;
}
async function requestPath(mode: Mode, format: Format, path: string): Promise<string[]> {
  const lines: string[] = [];
  const ordersContract = contract("orders", { "orders.show": { path: "/orders/:kind", params: Params } });
  const app = await createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    routes: manifest(ordersContract, {
      "orders.show": { component: () => document.createElement("main") },
    }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format, write: (l: string) => void lines.push(l) },
  });
  const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "application/json" } }));
  await res.text();
  return lines;
}
const reqPaths = (format: Format, lines: readonly string[]): string[] => {
  const out: string[] = [];
  for (const line of lines) {
    if (format === "compact") {
      if (isReq(line)) out.push(line.split(" ")[1] ?? "");
    } else {
      const r = record(line);
      const p = r.get("path");
      if (r.get("kind") === "req" && typeof p === "string") out.push(p);
    }
  }
  return out;
};

describe("k.serverlog bounds", () => {
  for (const mode of modes)
    for (const format of formats) {
      const where = `in ${mode}, ${format}`;
      it(
        `An action throwing an Error whose message is 1,000,000 a logs a diag whose message is its first 2,048 characters then the marker and the count left out, ${where}.`,
        async () => {
          const lines = await throwFromAction(mode, format, false, () => new Error(A_MILLION));
          const message = cutMessage(format, lines);
          expect(message.startsWith("action orders.show threw: ")).toBe(true);
          expectCutOfAs(message, 1_000_000);
          if (format === "json") for (const line of lines) JSON.parse(line);
        },
        fixedTime(30_000),
      );

      it(
        `A runner rejecting with an Error whose message is 1,000,000 a logs a diag whose message is its first 2,048 characters then the marker and the count left out, ${where}.`,
        async () => {
          const lines = await rejectFromRunner(mode, format, new Error(A_MILLION));
          const message = cutMessage(format, lines);
          expect(message.startsWith("runner rejected, rerun in 1000 ms: ")).toBe(true);
          expectCutOfAs(message, 1_000_000);
          if (format === "json") for (const line of lines) JSON.parse(line);
        },
        fixedTime(30_000),
      );

      it(
        `A request for a 5,000-character path logs a req path of its first 2,048 characters then the marker and 2952, ${where}.`,
        async () => {
          expect(LONG_PATH).toHaveLength(5_000);
          const lines = await requestPath(mode, format, LONG_PATH);
          expect(reqPaths(format, lines)).toEqual([`${LONG_PATH.slice(0, 2_048)}${MARK}+2952`]);
        },
        fixedTime(30_000),
      );

      it(
        `An action that reveals a secret and throws 2,000,001 characters logs action <id> threw: [secret], ${where}.`,
        async () => {
          const lines = await throwFromAction(mode, format, true, (secret) => {
            secret();
            return OVER_CAP;
          });
          const diag = messages(format, lines);
          expect(diag.some((m) => /^action [^ ]+ threw: \[secret\]$/.test(m))).toBe(true);
          for (const line of lines) expect(line).not.toContain("aaaaaaaa");
        },
        fixedTime(30_000),
      );

      it(
        `An action with no secret or pii value that throws 2,000,001 characters logs the first 2,048 characters then the marker and the count left out, ${where}.`,
        async () => {
          const lines = await throwFromAction(mode, format, false, () => OVER_CAP);
          const message = cutMessage(format, lines);
          expect(message.startsWith("action orders.show threw: ")).toBe(true);
          expectCutOfAs(message, 2_000_001);
        },
        fixedTime(30_000),
      );

      it(
        `A thrown message of 1,000,000 double quotes, euro signs or U+0001 gives lines of at most 8,192 characters and 12,288 bytes of UTF-8, from an action and from a runner, ${where}.`,
        async () => {
          for (const ch of ['"', "€", "\u0001"]) {
            const text = ch.repeat(1_000_000);
            const fromAction = await throwFromAction(mode, format, false, () => new Error(text));
            const fromRunner = await rejectFromRunner(mode, format, new Error(text));
            for (const lines of [fromAction, fromRunner]) {
              expect(lines.length).toBeGreaterThan(0);
              for (const line of lines) {
                expect(line.length).toBeLessThanOrEqual(8_192);
                expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(12_288);
                if (format === "json") JSON.parse(line);
              }
            }
          }
        },
        fixedTime(60_000),
      );
    }
});
