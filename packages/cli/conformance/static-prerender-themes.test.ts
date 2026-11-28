// Spec: k.hosting, clause "`pnpm keel build` of a fixture whose topology is one `static` deployable `site` with `tokens.ts` declaring one `choice` theme `slate`, over a module whose route `/` renders a `ThemeSelect`, writes `dist/site/index.html` whose select has the options `default` and `slate` in that order, and no `schemes.json`, `routes.json` or `std.json` under `dist/site/`; that document resumed in a browser logs no E1253."
// Spec text (k.hosting Static): "That `createApp` is given the artifacts a `node` deployable's is (`routes.json`, `std.json`, `schemes.json`: k.schemes First paint), so each prerendered document's markup equals the first client render's of its route, a `ThemeSelect`'s options included, and resuming it raises no E1253."
// Seed: 1337 (recorded; no generated input: the fixture is the clause's one project, built once per adapter and shared by the cases).
// Method: the real `keel` binary over temp projects (static-support.ts's `staticTree`, `@keel/*` linked as compat-support.ts does); the page of module `s` renders a `ThemeSelect` beside its island button, on routes `/` and `/about`.
// The resume half runs through `keel test --e2e` over a `test/resume.e2e.ts` of the project, which uses `@keel/testing/e2e` `serve` of the build: it needs Chromium and `playwright-core` (as e2e-command.test.ts has them); none skips.
// Reading of "the first client render's": the held document (`open` with `hold: true`, no script run) and the same page after `resume()` describe the same elements: `find` of the page's shown ids (text and button) is equal before and after. The `ThemeSelect` is not shown while held (k.schemes Choice: "It renders with `hidden` on the element it returns, the wrapper holding its label and its select, which the runtime removes at mount and at resume." and "`ThemeSelect` is the same control for a theme"), and `find` waits for a shown element (k.e2e-page: "once the element is shown"), so it is asserted not shown before `resume()` (`until` with `gone: true`, `findAll`) and found after it, value `default`, its options' texts in order.
// Reading of "a `node` deployable's request render": the same project with adapter `node`, `node dist/site/server.mjs` answering `GET /`, lists the options `default`, `slate` in that order, equal to the static document's.
import { testTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { type Tree, cleanup, materialize } from "./compat-support.ts";
import { get, staticTree, withServer } from "./static-support.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const SLOW = testTime(600_000);
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});

const TOKENS = `import { defineTokens } from "@keel/ui/tokens";\nimport { brandTokens } from "@keel/ui/brand";\nexport const tokens = defineTokens({ ...brandTokens, themes: { slate: { color: { surface: '#F4F7FB' } } } });\n`;
const PAGE =
  "import { Box, Button, Text, ThemeSelect } from '@keel/ui'\nexport default function Page(props: { data: { text: string } }) {\n  return (\n" +
  '    <Box id="s.page">\n      <Text id="s.page.text">{props.data.text}</Text>\n      <ThemeSelect id="s.page.theme" label="Theme" labels={{ default: "Keel", slate: "Slate" }} />\n      <Button id="s.page.more" onClick={() => undefined}>More</Button>\n    </Box>\n  )\n}\n';
const RESUME_E2E = `import { expect, it } from "vitest";
import { serve } from "@keel/testing/e2e";

const IDS = ["s.page.text", "s.page.more"];
for (const path of ["/", "/about"]) {
  it(\`resuming \${path} raises no E1253\`, async () => {
    const served = await serve();
    try {
      const page = await served.open(path);
      await page.settle();
      const e1253 = page.problems().filter((p) => p.text.includes("E1253"));
      expect(e1253).toEqual([]);
    } finally {
      await served.dispose();
    }
  });
  it(\`the first client render of \${path} equals the prerendered document, the select's options included\`, async () => {
    const served = await serve();
    try {
      const page = await served.open(path, { hold: true });
      const before = await Promise.all(IDS.map((id) => page.find(id)));
      await page.until("s.page.theme", { gone: true });
      const heldIds = (await page.findAll("s.page")).map((e) => e.id);
      expect(heldIds).not.toContain("s.page.theme");
      for (const id of IDS) expect(heldIds).toContain(id);
      await page.resume();
      const after = await Promise.all(IDS.map((id) => page.find(id)));
      expect(JSON.stringify(after)).toBe(JSON.stringify(before));
      const theme = await page.find("s.page.theme");
      expect(theme.value).toBe("default");
      expect(theme.text).toMatch(/^Keel\s*Slate$/);
      expect((await page.findAll("s.page")).map((e) => e.id)).toContain("s.page.theme");
      expect(page.problems().filter((p) => p.text.includes("E1253"))).toEqual([]);
    } finally {
      await served.dispose();
    }
  });
}
`;

const tree = (adapter: string): Tree => ({
  ...staticTree("none", undefined, adapter),
  "tokens.ts": TOKENS,
  "modules/s/Page.tsx": PAGE,
});

function playwrightCore(): string | undefined {
  const hoisted = join(REPO, "node_modules", "playwright-core");
  if (existsSync(hoisted)) return hoisted;
  const store = join(REPO, "node_modules", ".pnpm");
  const found = existsSync(store) ? readdirSync(store).find((n) => n.startsWith("playwright-core@")) : undefined;
  return found === undefined ? undefined : join(store, found, "node_modules", "playwright-core");
}
function typesNode(): string | undefined {
  const hoisted = join(REPO, "node_modules", "@types", "node");
  if (existsSync(hoisted)) return hoisted;
  const store = join(REPO, "node_modules", ".pnpm");
  const found = existsSync(store)
    ? readdirSync(store)
        .filter((n) => n.startsWith("@types+node@"))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0]
    : undefined;
  return found === undefined ? undefined : join(store, found, "node_modules", "@types", "node");
}
function project(files: Tree): string {
  const dir = materialize(files);
  made.push(dir);
  const pw = playwrightCore();
  if (pw !== undefined) symlinkSync(pw, join(dir, "node_modules", "playwright-core"));
  const types = typesNode();
  if (types !== undefined) {
    mkdirSync(join(dir, "node_modules", "@types"), { recursive: true });
    symlinkSync(types, join(dir, "node_modules", "@types", "node"));
  }
  return dir;
}

type Out = { status: number | null; stdout: string };
/** `keel <args>` in `dir` with no `KEEL_*` of this run's env; the build and the browser are waits of the machine's own, so fixed time. */
function run(dir: string, args: readonly string[]): Out {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "NODE_ENV") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, ...args, "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env,
    timeout: testTime(540_000),
    killSignal: "SIGKILL",
  });
  return { status: r.status, stdout: r.stdout };
}

const cache = new Map<string, { dir: string; build: Out }>();
/** One project per kind, built once: `static`, `node`, or `static` with the resume file (built by `keel test --e2e`). */
function built(kind: "static" | "node" | "e2e"): { dir: string; build: Out } {
  const known = cache.get(kind);
  if (known !== undefined) return known;
  const files =
    kind === "node"
      ? tree("node")
      : kind === "e2e"
        ? { ...tree("static"), "test/resume.e2e.ts": RESUME_E2E }
        : tree("static");
  const dir = project(files);
  const entry = { dir, build: kind === "e2e" ? run(dir, ["test", "--e2e"]) : run(dir, ["build"]) };
  cache.set(kind, entry);
  return entry;
}

const optionValues = (html: string): string[] => {
  const selects = [...html.matchAll(/<select\b[\s\S]*?<\/select>/g)];
  const first = selects[0]?.[0] ?? "";
  return [...first.matchAll(/<option\b[^>]*>/g)].flatMap((m) => {
    const v = /\bvalue="([^"]*)"/.exec(m[0])?.[1];
    return v === undefined ? [] : [v];
  });
};
const filesUnder = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (rel: string): void => {
    const full = join(dir, rel);
    if (statSync(full).isDirectory()) for (const n of readdirSync(full).sort()) walk(join(rel, n));
    else out.push(rel);
  };
  if (existsSync(dir)) walk("");
  return out;
};
const e2eStates = (dir: string): string[] => {
  const report: unknown = JSON.parse(readFileSync(join(dir, "reports/tests/e2e.json"), "utf8"));
  const files = typeof report === "object" && report !== null ? Reflect.get(report, "files") : undefined;
  const entry = typeof files === "object" && files !== null ? Reflect.get(files, "test/resume.e2e.ts") : undefined;
  const tests = typeof entry === "object" && entry !== null ? Reflect.get(entry, "tests") : undefined;
  return Array.isArray(tests) ? tests.map((t) => String(Reflect.get(Object(t), "state"))) : [];
};

describe("k.hosting Static: a prerendered document lists the themes the client's resume knows", () => {
  it(
    "`pnpm keel build` of a fixture whose topology is one `static` deployable `site` with `tokens.ts` declaring one `choice` theme `slate`, over a module whose route `/` renders a `ThemeSelect`, writes `dist/site/index.html` whose select has the options `default` and `slate` in that order",
    () => {
      const { dir, build } = built("static");
      expect(build.status, build.stdout.slice(-1500)).toBe(0);
      const html = readFileSync(join(dir, "dist", "site", "index.html"), "utf8");
      expect(optionValues(html)).toEqual(["default", "slate"]);
      // Each route's document, not `/` alone (k.hosting Static: each prerendered document).
      expect(optionValues(readFileSync(join(dir, "dist", "site", "about", "index.html"), "utf8"))).toEqual([
        "default",
        "slate",
      ]);
    },
    SLOW,
  );

  it(
    "the build writes no `schemes.json`, `routes.json` or `std.json` under `dist/site/`",
    () => {
      const { dir, build } = built("static");
      expect(build.status, build.stdout.slice(-1500)).toBe(0);
      const names = filesUnder(join(dir, "dist", "site")).map((f) => f.split("/").at(-1));
      for (const n of ["schemes.json", "routes.json", "std.json"]) expect(names, n).not.toContain(n);
    },
    SLOW,
  );

  it(
    "that document resumed in a browser logs no E1253",
    () => {
      const { dir, build } = built("e2e");
      expect(build.status, build.stdout.slice(-2500)).toBe(0);
      const states = e2eStates(dir);
      expect(states).toHaveLength(4);
      // Cases 0 and 2 are `resuming <path> raises no E1253` for `/` and `/about`.
      expect([states[0], states[2]]).toEqual(["passed", "passed"]);
    },
    SLOW,
  );

  it(
    "each prerendered document's markup equals the first client render's of its route, a `ThemeSelect`'s options included",
    () => {
      const { dir, build } = built("e2e");
      expect(build.status, build.stdout.slice(-2500)).toBe(0);
      // Cases 1 and 3 hold the page before `resume()` against the page after it, for `/` and `/about`: the shown ids equal, the `ThemeSelect` hidden while held and shown after.
      const states = e2eStates(dir);
      expect([states[1], states[3]]).toEqual(["passed", "passed"]);
      const html = readFileSync(join(dir, "dist", "site", "index.html"), "utf8");
      expect(optionValues(html)).toEqual(["default", "slate"]);
    },
    SLOW,
  );

  it(
    "a `node` deployable's request render of the same page lists the same options as the prerendered document",
    async () => {
      const prerendered = built("static");
      expect(prerendered.build.status, prerendered.build.stdout.slice(-1500)).toBe(0);
      const staticOptions = optionValues(readFileSync(join(prerendered.dir, "dist", "site", "index.html"), "utf8"));
      const node = built("node");
      expect(node.build.status, node.build.stdout.slice(-1500)).toBe(0);
      await withServer(node.dir, "site", async (port) => {
        const reply = await get(port, "/");
        expect(reply?.status).toBe(200);
        expect(optionValues(reply?.body ?? "")).toEqual(["default", "slate"]);
        expect(optionValues(reply?.body ?? "")).toEqual(staticOptions);
      });
    },
    SLOW,
  );
});
