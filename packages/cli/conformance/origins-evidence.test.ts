// Spec: k.origins, clause "`security.json` lists each declared origin with directive and reason in order; `origins: []` with none."
// k.evidence, Command "Each `security.json` entry (`adapter`, `name`, then `headers` and `policy`, or `csp`) carries `origins`: `{ directive, origin, reason }` per declared origin (k.origins), directives in the order `img`, `media`, `font`, `connect`, `frame`, origins in declaration order; `[]` with none."
// Seed 1337 (no generated input: one fixture). Fixture: `node` deployable `web` declaring all five directives, written out of directive order and with `b` before `a`;
// `client` deployable `app` declaring none. The entries are read from the `deployables` list of `security.json`, found by `name`.
import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TEST_KEY_PEM, fixtureTree, parseJson, project, readTree, removeDir, writeBundle } from "./evidence-fixture.ts";

const SLOW = 600_000;
const DECLARED = `{
  frame: { 'https://f.example': 'frame reason' },
  connect: { 'https://d.example': 'connect reason 2', 'https://c.example': 'connect reason 1' },
  font: { 'https://font.example': 'font reason' },
  media: { 'https://m.example': 'media reason' },
  img: { 'https://b.example': 'img reason b', 'https://a.example': 'img reason a' },
}`;
const TOPOLOGY =
  "import { topology } from '@keel/server'\n" +
  "export default topology({\n" +
  `  web: { modules: ['a'], adapter: 'node', origins: ${DECLARED} },\n` +
  "  app: { modules: ['c'], adapter: 'client' },\n" +
  "})\n";
const EXPECTED = [
  { directive: "img", origin: "https://b.example", reason: "img reason b" },
  { directive: "img", origin: "https://a.example", reason: "img reason a" },
  { directive: "media", origin: "https://m.example", reason: "media reason" },
  { directive: "font", origin: "https://font.example", reason: "font reason" },
  { directive: "connect", origin: "https://d.example", reason: "connect reason 2" },
  { directive: "connect", origin: "https://c.example", reason: "connect reason 1" },
  { directive: "frame", origin: "https://f.example", reason: "frame reason" },
];

function entry(v: unknown, name: string): Record<string, unknown> | undefined {
  const list: unknown = typeof v === "object" && v !== null ? Reflect.get(v, "deployables") : undefined;
  if (!Array.isArray(list)) return undefined;
  for (const x of list) {
    if (typeof x === "object" && x !== null && Reflect.get(x, "name") === name)
      return Object.fromEntries(Object.entries(x));
  }
  return undefined;
}

let dir = "";
let base = "";
let web: Record<string, unknown> | undefined;
let app: Record<string, unknown> | undefined;
beforeAll(() => {
  dir = project(fixtureTree({ extra: { "topology.ts": TOPOLOGY } }));
  const written = writeBundle(dir, TEST_KEY_PEM);
  base = written.base;
  const doc = parseJson(readTree(written.out).get("security.json"));
  web = entry(doc, "web");
  app = entry(doc, "app");
}, SLOW);
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  removeDir(base);
});

describe("k.origins: security.json", () => {
  test(
    "`security.json` lists each declared origin as `{ directive, origin, reason }`, directives in the order `img`, `media`, `font`, `connect`, `frame` and origins in declaration order",
    () => {
      expect(web?.["origins"]).toEqual(EXPECTED);
      const list = web?.["origins"];
      if (Array.isArray(list)) {
        for (const o of list) expect(Object.keys(o)).toEqual(["directive", "origin", "reason"]);
      }
    },
    SLOW,
  );

  test(
    "`security.json` has `origins: []` for a deployable with none",
    () => {
      expect(app?.["origins"]).toEqual([]);
    },
    SLOW,
  );

  test(
    "each entry is `adapter`, `name`, then `headers` and `policy`, or `csp`, then `origins`",
    () => {
      expect(Object.keys(web ?? {})).toEqual(["adapter", "name", "headers", "policy", "origins"]);
      expect(Object.keys(app ?? {})).toEqual(["adapter", "name", "csp", "origins"]);
    },
    SLOW,
  );

  test(
    "the `node` entry's policy carries the declared origins that its `origins` list",
    () => {
      const policy = String(web?.["policy"]);
      expect(policy).toContain("img-src 'self' https://b.example https://a.example");
      expect(policy).toContain("frame-src https://f.example");
    },
    SLOW,
  );
});
