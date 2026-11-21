// @vitest-environment node
// `packages/std-sessions/action/action.yml` (std.sessions Commands, the Action): a structural parse of the composite
// action (no YAML parser in the workspace): block-style mappings only, inputs `url` and `token` required, `token`
// exported as KEEL_SESSIONS_TOKEN, actions pinned by SHA, the step runs `keel-session-action`, and nothing pushes.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const text = readFileSync(path.join(import.meta.dirname, "..", "action", "action.yml"), "utf8");

/** `key: value` lines as `a.b.c` paths, from two-space indentation; list items get their index. */
function paths(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const stack: { indent: number; key: string }[] = [];
  const counts = new Map<string, number>();
  for (const raw of src.split("\n")) {
    if (raw.trim() === "" || raw.trimStart().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    let body = raw.trim();
    while (stack.length > 0 && (stack.at(-1)?.indent ?? 0) >= indent) stack.pop();
    if (body.startsWith("- ")) {
      const parent = stack.map((s) => s.key).join(".");
      const n = counts.get(parent) ?? 0;
      counts.set(parent, n + 1);
      stack.push({ indent, key: String(n) });
      body = body.slice(2);
    }
    const m = /^([A-Za-z0-9_-]+):(?:\s+(.*))?$/.exec(body);
    if (m?.[1] === undefined) continue;
    const at = [...stack.map((s) => s.key), m[1]].join(".");
    out.set(at, m[2] ?? "");
    stack.push({ indent: body === raw.trim() ? indent : indent + 2, key: m[1] });
  }
  return out;
}

describe("action.yml", () => {
  const p = paths(text);
  test("is block YAML with even indentation and no tabs", () => {
    for (const line of text.split("\n")) {
      expect(line).not.toMatch(/\t/);
      expect((line.length - line.trimStart().length) % 2).toBe(0);
    }
  });
  test("is a composite action with required url and token", () => {
    expect(p.get("runs.using")).toBe("composite");
    expect(p.get("inputs.url.required")).toBe("true");
    expect(p.get("inputs.token.required")).toBe("true");
    expect(p.get("inputs.working-directory.required")).toBe("false");
  });
  test("its last step runs keel-session-action with the token as KEEL_SESSIONS_TOKEN", () => {
    expect(p.get("runs.steps.3.run")).toBe("pnpm exec keel-session-action");
    expect(p.get("runs.steps.3.working-directory")).toBe("${{ inputs.working-directory }}");
    expect(p.get("runs.steps.3.env.KEEL_SESSIONS_TOKEN")).toBe("${{ inputs.token }}");
    expect(p.get("runs.steps.3.env.KEEL_SESSIONS_URL")).toBe("${{ inputs.url }}");
    expect(p.get("runs.steps.3.env.GITHUB_TOKEN")).toBe("${{ inputs.github-token }}");
  });
  test("installs in working-directory and pins every action by commit SHA", () => {
    expect(p.get("runs.steps.2.run")).toBe("pnpm install --frozen-lockfile");
    expect(p.get("runs.steps.2.working-directory")).toBe("${{ inputs.working-directory }}");
    const uses = text.split("\n").filter((l) => /^\s*- uses:/.test(l));
    expect(uses).toHaveLength(2);
    for (const l of uses) expect(l).toMatch(/@[0-9a-f]{40} # v\d+\.\d+\.\d+$/);
  });
  test("states its permissions and never pushes", () => {
    expect(text).toContain("issues write and contents read");
    expect(text).not.toMatch(/git push|contents: write/);
  });
});
