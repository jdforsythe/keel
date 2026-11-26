// The pure parts of `@keel/testing/e2e`: a wait's bound (k.e2e Time), a server log line's record and its compact form
// (docs/OUTPUT.md Server log), the variables `deploy/compose.yaml` requires, a template id's head, and the line a
// failure is named after. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { boundMs } from "../src/internal/e2e/boundMs.ts";
import { compactRecord } from "../src/internal/e2e/compactRecord.ts";
import { composeRequired } from "../src/internal/e2e/composeRequired.ts";
import { failureLine } from "../src/internal/e2e/failureLine.ts";
import { idHeads } from "../src/internal/e2e/idHeads.ts";
import { parseLogLine } from "../src/internal/e2e/parseLogLine.ts";

const SEED = { seed: 1337, numRuns: 200 };
const ms = fc.integer({ min: 0, max: 600_000 });
const scale = fc.double({ min: 0.05, max: 20, noNaN: true });

describe("boundMs", () => {
  it("is 10 s whatever the scale with neither part, within times the scale plus fixed otherwise", () => {
    fc.assert(
      fc.property(fc.option(ms, { nil: undefined }), fc.option(ms, { nil: undefined }), scale, (within, fixed, k) => {
        const wait = { ...(within === undefined ? {} : { within }), ...(fixed === undefined ? {} : { fixed }) };
        const got = boundMs(wait, k);
        if (within === undefined && fixed === undefined) expect(got).toBe(10_000);
        else expect(got).toBe(Math.max(1, Math.round((within ?? 0) * k + (fixed ?? 0))));
      }),
      SEED,
    );
  });

  it("does not scale fixed time", () => {
    fc.assert(
      fc.property(ms, scale, (fixed, k) => {
        expect(boundMs({ fixed }, k)).toBe(Math.max(1, fixed));
      }),
      SEED,
    );
    expect(boundMs({ within: 2000, fixed: 5000 }, 0.5)).toBe(6000);
  });
});

describe("parseLogLine and compactRecord", () => {
  const word = fc.stringMatching(/^[A-Za-z0-9./_-]{1,20}$/);
  it("a req record parses back and prints as method, path, route, status and time", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("GET", "POST", "PUT"),
        word.map((w) => `/${w}`),
        fc.option(word, { nil: undefined }),
        fc.integer({ min: 100, max: 599 }),
        fc.integer({ min: 0, max: 9999 }),
        (method, path, route, status, t) => {
          const line = JSON.stringify({
            kind: "req",
            method,
            path,
            ...(route === undefined ? {} : { route }),
            status,
            ms: t,
          });
          const r = parseLogLine(line);
          expect(r).toEqual({ kind: "req", method, path, ...(route === undefined ? {} : { route }), status, ms: t });
          expect(compactRecord(r)).toBe(
            [method, path, route, String(status), `${t}ms`].filter((p) => p !== undefined).join(" "),
          );
        },
      ),
      SEED,
    );
  });

  it("a line that is no record is kept as its text", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const r = parseLogLine(text);
        if (r.kind === "other") expect(compactRecord(r)).toBe(text);
      }),
      SEED,
    );
    expect(parseLogLine("ok listening on port 1")).toEqual({ kind: "other", text: "ok listening on port 1" });
    expect(compactRecord(parseLogLine('{"kind":"diag","code":"E1577","message":"uncaught"}'))).toBe("E1577 uncaught");
  });
});

describe("composeRequired", () => {
  it("lists each service's `NAME: ${NAME:?}` lines and no optional one", () => {
    const names = fc.uniqueArray(fc.stringMatching(/^[A-Z][A-Z0-9_]{0,10}$/), { maxLength: 5 });
    fc.assert(
      fc.property(names, names, (required, optional) => {
        const env = [
          ...required.map((n) => `      ${n}: \${${n}:?}`),
          ...optional.filter((n) => !required.includes(n)).map((n) => `      ${n}: \${${n}:-}`),
        ];
        const yaml = [
          "services:",
          "  api:",
          "    build:",
          "      context: ..",
          "    environment:",
          ...env,
          "volumes:",
          "  api-data: {}",
        ];
        expect(composeRequired(yaml.join("\n")).get("api")).toEqual(required);
      }),
      SEED,
    );
  });
});

describe("idHeads", () => {
  it("is the fixed head of each template id, once", () => {
    expect(
      idHeads(["<b id={`shop.row.${r.id}`} />", "id={`shop.row.${x}`}", "id={`a.b-c.${k}.x`}", "id={`${k}.x`}"]),
    ).toEqual(["a.b-c.", "shop.row."]);
  });
});

describe("failureLine", () => {
  it("is the first frame in the test file, else the test's own place", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 1, max: 200 }), (line, col) => {
        const stack = `Error: x\n    at f (/p/node_modules/a.js:1:1)\n    at /proj/test/a.e2e.ts:${line}:${col}\n    at /proj/test/a.e2e.ts:1:1`;
        expect(failureLine(stack, "/proj/test/a.e2e.ts", { line: 7, column: 3 })).toEqual({ line, column: col });
        expect(failureLine("Error: x", "/proj/test/a.e2e.ts", { line: 7, column: 3 })).toEqual({ line: 7, column: 3 });
      }),
      SEED,
    );
  });
});
