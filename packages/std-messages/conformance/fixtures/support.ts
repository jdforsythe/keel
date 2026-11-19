// Shared helpers for the std.messages conformance suite. Seed for every property: 1337.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";

export const SEED = 1337;
export type Files = Parameters<typeof check>[0];

export const MODULE = `import { module } from '@keel/compiler'
export default module({
  id: 'recipes',
  deps: ['@keel/std-messages', '@keel/std-i18n'],
  capabilities: [],
  public: { exports: [], routes: [] },
})
`;

/** The clean module: two locales, three keys (one without params), a component that reads each key. */
export const CLEAN: Record<string, string> = {
  "modules/recipes/module.ts": MODULE,
  "modules/recipes/AppLocale.schema.ts": `import { s } from '@keel/schema'
export const AppLocale = s.enum(['en-US', 'de-DE'])
`,
  "modules/recipes/RecipesText.schema.ts": `import { s } from '@keel/schema'
import { messages } from '@keel/std-messages'
import { AppLocale } from './AppLocale.schema.ts'
export const RecipesText = messages(AppLocale, { title: {}, count: { n: s.int({ min: 0 }) }, total: { n: s.int() } }, (locale) => import(\`./RecipesText/\${locale}.ts\`))
`,
  "modules/recipes/RecipesText/en-US.ts": `import { RecipesText } from '../RecipesText.schema.ts'
export default RecipesText.text({ title: 'Recipes', count: { plural: 'n', one: '# recipe', other: '# recipes' }, total: { text: 'Total {n}' } })
`,
  "modules/recipes/RecipesText/de-DE.ts": `import { RecipesText } from '../RecipesText.schema.ts'
export default RecipesText.text({ title: 'Rezepte', count: { plural: 'n', one: '# Rezept', other: '# Rezepte' }, total: { text: 'Summe {n}' } })
`,
  "modules/recipes/RecipeList.tsx": `import { formatMessage } from '@keel/std-messages'
export default function RecipeList(props) {
  const t = props.data.text
  return <main aria-label={t.title}><h1>{t.title}</h1><p>{formatMessage(t.count, { n: 2 }, props.params.locale)}</p><p>{formatMessage(t.total, { n: 2 }, props.params.locale)}</p></main>
}
`,
};

/** `CLEAN` with files replaced (a string) or removed (null). */
export function tree(overrides: Record<string, string | null> = {}): Files {
  const merged: Record<string, string | null> = { ...CLEAN, ...overrides };
  const files: { path: string; source: string }[] = [];
  for (const [path, source] of Object.entries(merged)) if (source !== null) files.push({ path, source });
  return files;
}

export function codesOf(files: Files, code: string) {
  return check(files, { types: false }).diagnostics.filter((d) => d.code === code);
}

export function applyFix(files: Files, fix: string): Files {
  const dir = mkdtempSync(join(tmpdir(), "keel-fix-"));
  try {
    for (const f of files) {
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.source);
    }
    writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return files.map((f) => ({ path: f.path, source: readFileSync(join(dir, f.path), "utf8") }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
