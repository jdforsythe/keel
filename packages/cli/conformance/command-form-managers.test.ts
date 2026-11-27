// k.cli, Command form "A line `keel` prints names each `keel <command>` in the form the reader runs it from: when `npm_config_user_agent` names pnpm, npm, yarn or bun, that manager's (`pnpm keel build`, `npx --no keel build`, `yarn keel build`, `bun run keel build`), since a `keel` on PATH may be another program; with none, `keel build`. A `keel` already in a manager's form is left as it is. Compact and pretty only; json keeps each record's text."
// Seed 1337 (recorded; no generated inputs). The line is the E1052 of `keel codemod move OrderCard` (k.cli: it names `--to <module>` and a line passing it), run in process with an injected environment.
import { describe, expect, it } from "vitest";
import { keel, lines, parseJsonLines } from "./fixtures";

const FORMS = [
  ["pnpm/10.0.0 npm/? node/v22.15.0", "pnpm keel"],
  ["npm/10.9.0 node/v22.15.0", "npx --no keel"],
  ["yarn/4.5.0 npm/? node/v22.15.0", "yarn keel"],
  ["bun/1.2.0 node/v22.15.0", "bun run keel"],
] as const;

const move = async (env: Record<string, string>, format: string) =>
  keel(["codemod", "move", "OrderCard", `--format=${format}`], { env });

describe("k.cli Command form", () => {
  for (const [agent, form] of FORMS) {
    it(`when \`npm_config_user_agent\` is \`${agent}\`, a \`keel <command>\` in a printed line is \`${form} <command>\`, in compact and pretty`, async () => {
      for (const format of ["compact", "pretty"]) {
        const r = await move({ npm_config_user_agent: agent }, format);
        const text = `${r.stdout}${r.stderr}`;
        expect(text, format).toContain(`${form} codemod move OrderCard --to`);
        expect(text, format).toContain(`${form} docs`);
      }
    });
  }

  it("with none, `keel build`: a `keel <command>` in a printed line is left bare, for no user agent and for one naming another manager", async () => {
    for (const env of [{}, { npm_config_user_agent: "deno/2.0.0 node/v22.15.0" }]) {
      const r = await move(env, "compact");
      const text = `${r.stdout}${r.stderr}`;
      expect(text).toContain("keel codemod move OrderCard --to");
      expect(text).not.toMatch(/(pnpm|yarn|bun run) keel|npx --no keel/);
    }
  });

  it("`bun run keel` and `yarn keel` are not nested again: a `keel` already in a manager's form is left as it is", async () => {
    for (const [agent, form] of FORMS) {
      const r = await move({ npm_config_user_agent: agent }, "compact");
      const text = `${r.stdout}${r.stderr}`;
      expect(text).not.toContain(`${form} ${form}`);
      expect(text).not.toMatch(/keel keel/);
    }
  });

  it("json keeps each record's text: with `yarn/4.5.0` and with `bun/1.2.0` the records equal those with none", async () => {
    const none = parseJsonLines((await move({}, "json")).stdout);
    for (const [agent] of FORMS.slice(2)) {
      expect(parseJsonLines((await move({ npm_config_user_agent: agent }, "json")).stdout)).toEqual(none);
    }
    expect(lines(JSON.stringify(none)).length).toBeGreaterThan(0);
  });
});
