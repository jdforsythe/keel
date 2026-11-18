// @vitest-environment node
// k.privacy Server log: each string in a `Secret` revealed while a scope runs is `[secret]` in that scope's records,
// whatever the value holds when the scope reveals it again after changing it in place. Seed 1337.
import { reveal, s } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { noteRequestSecrets } from "../src/internal/noteRequestSecrets.ts";
import { redacted } from "../src/internal/redacted.ts";
import { requestSecrets } from "../src/internal/requestSecrets.ts";

const Token = s.secret(s.object({ token: s.string() }));

describe("a revealed value changed in place", () => {
  // Open: a scope walks each Secret once, and a revealed value is not frozen.
  test.fails("is marked when the scope reveals it again", () => {
    noteRequestSecrets();
    const parsed = Token.parse({ token: "old-token-1234" });
    if (!parsed.ok) throw new Error("parse");
    const into = new Set<string>();
    let held = "";
    requestSecrets.run(into, () => {
      const v = reveal(parsed.value);
      Reflect.set(v, "token", "rotated-token-5678");
      held = reveal(parsed.value).token;
    });
    const text = redacted(`threw with ${held}`, { secrets: into, pii: new Set() });
    expect(text).toBe("threw with [secret]");
  });
});
