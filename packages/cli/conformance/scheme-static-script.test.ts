// Spec: k.schemes, clause "`keel build` of a `static` deployable, and of a `client` deployable, with both schemes whose page renders a `SchemeSelect` writes an `index.html` whose head holds a `<script src=\"/assets/keel-scheme-` before its first `<link rel=\"stylesheet\"`, naming a file of at most 300 bytes; without the `SchemeSelect`, no `keel-scheme` script."
// Seed: 1337 (no generated input: four spawned builds, a select and a plain fixture per adapter, shared by the cases).
// Needs a real browser: that the script sets the attribute before the body is parsed, and that no flash shows, are end-to-end cases; here the script's text is read for the cookie name and the attribute it writes, and its bytes counted. "An app with one scheme holds no scheme script" is not asserted: a `SchemeSelect` over one scheme is E1814, which fails the check before a build (packages/check/conformance/schemes-contrast.test.ts).
// ASSUMPTIONS: the fixture is staticTree's project (static-support.ts) whose `Page` also renders a `SchemeSelect` and whose root `tokens.ts` gives both schemes; the `client` fixture is the same project with the deployable `site` given adapter `client` (alone, no `servedBy`), its `index.html` read the same way as the `static` one's.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { cleanup, keel, materialize, type Run, type Tree } from "./compat-support.ts";
import { SLOW, staticTree } from "./static-support.ts";

const TOKENS = `import { defineTokens } from "@keel/ui";\nimport { brandTokens } from "@keel/ui/brand";\nexport const tokens = defineTokens({ ...brandTokens, schemes: ["light", "dark"] });\n`;
const SELECT_PAGE =
  "import { Box, SchemeSelect, Text } from '@keel/ui'\nexport default function Page(props: { data: { text: string } }) {\n  return (\n" +
  '    <Box id="s.page">\n      <Text id="s.page.text">{props.data.text}</Text>\n      <SchemeSelect id="s.page.scheme" label="Scheme" labels={{ system: "System", light: "Light", dark: "Dark" }} />\n    </Box>\n  )\n}\n';
const ADAPTERS = ["static", "client"] as const;
const withSelect = (adapter: string): Tree => ({
  ...staticTree("none", undefined, adapter),
  "tokens.ts": TOKENS,
  "modules/s/Page.tsx": SELECT_PAGE,
});
const withoutSelect = (adapter: string): Tree => ({ ...staticTree("none", undefined, adapter), "tokens.ts": TOKENS });

const selectDirs = new Map<string, string>();
const plainDirs = new Map<string, string>();
const selectDir = (adapter: string): string => selectDirs.get(adapter) ?? "";
const plainDir = (adapter: string): string => plainDirs.get(adapter) ?? "";
const runs = new Map<string, Run>();
const built = (dir: string): Run => {
  const known = runs.get(dir);
  if (known !== undefined) return known;
  const r = keel(dir, ["build"]);
  runs.set(dir, r);
  return r;
};
beforeAll(() => {
  for (const a of ADAPTERS) {
    selectDirs.set(a, materialize(withSelect(a)));
    plainDirs.set(a, materialize(withoutSelect(a)));
  }
}, SLOW);
afterAll(() => {
  for (const d of [...selectDirs.values(), ...plainDirs.values()]) cleanup(d);
});

const site = (dir: string, rel: string): string => join(dir, "dist", "site", rel);
const head = (html: string): string => /<head[^>]*>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? "";
const SCRIPT = /<script src="(\/assets\/keel-scheme-[^"]+\.js)"><\/script>/;

for (const adapter of ADAPTERS) {
  test(
    `\`keel build\` of a \`${adapter}\` deployable with both schemes whose page renders a \`SchemeSelect\` writes an \`index.html\` whose head holds a \`<script src="/assets/keel-scheme-\` before its first \`<link rel="stylesheet"\`, naming a file of at most 300 bytes; without the \`SchemeSelect\`, no \`keel-scheme\` script`,
    () => {
      const dir = selectDir(adapter);
      expect(built(dir).status).toBe(0);
      const h = head(readFileSync(site(dir, "index.html"), "utf8"));
      const m = SCRIPT.exec(h);
      expect(m, "a keel-scheme script in the head").not.toBeNull();
      const at = m?.index ?? -1;
      const link = h.indexOf('<link rel="stylesheet"');
      expect(link).toBeGreaterThanOrEqual(0);
      expect(at).toBeLessThan(link);
      const file = site(dir, m?.[1] ?? "");
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(300);

      expect(built(plainDir(adapter)).status).toBe(0);
      expect(readFileSync(site(plainDir(adapter), "index.html"), "utf8")).not.toContain("keel-scheme");
    },
    SLOW,
  );

  test(
    `each document of the \`${adapter}\` deployable holds the script, a classic one (no \`type="module"\`, no \`async\`, no \`defer\`), and no inline script holds the scheme code`,
    () => {
      const dir = selectDir(adapter);
      built(dir);
      for (const doc of ["index.html", "about/index.html"]) {
        const html = readFileSync(site(dir, doc), "utf8");
        const tag = /<script[^>]*keel-scheme[^>]*>/.exec(head(html))?.[0] ?? "";
        expect(tag, doc).not.toBe("");
        expect(tag).not.toMatch(/type="module"|\basync\b|\bdefer\b/);
        for (const inline of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
          expect(inline[1] ?? "").not.toContain("data-k-scheme");
        }
      }
    },
    SLOW,
  );

  test(
    `the \`${adapter}\` script reads the \`keel-scheme\` cookie and sets \`data-k-scheme\` on the document element, and the policy in \`csp.txt\` allows scripts from \`'self'\` with no inline script`,
    () => {
      const dir = selectDir(adapter);
      built(dir);
      const m = SCRIPT.exec(head(readFileSync(site(dir, "index.html"), "utf8")));
      const src = readFileSync(site(dir, m?.[1] ?? "none"), "utf8");
      expect(src).toContain("keel-scheme");
      expect(src).toContain("data-k-scheme");
      expect(src).toMatch(/light/);
      expect(src).toMatch(/dark/);
      const csp = readFileSync(site(dir, "csp.txt"), "utf8");
      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toContain("'unsafe-inline'");
    },
    SLOW,
  );
}
