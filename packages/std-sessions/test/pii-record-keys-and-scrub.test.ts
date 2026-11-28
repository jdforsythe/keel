// std.sessions: a marked s.record loses its keys; the error scrub also finds other cases, URL-encoded and JSON-escaped forms and short tokens.
// Seed 1337
import { s } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { redactionOf } from "../src/internal/redactionOf.ts";

const S = s.object({ by: s.record(s.number()).pii("contact"), open: s.record(s.number()) });

describe("marked record keys", () => {
  test("become x0, x1, ... (distinct, parseable); an unmarked record keeps its keys", () => {
    const out = redactionOf([], 7).state("u", S, {
      by: { "bob@example.com": 3, "amy@example.com": 4 },
      open: { a: 1 },
    });
    expect(JSON.stringify(out)).not.toContain("example.com");
    const parsed = S.parse(out);
    expect(parsed.ok ? Object.keys(parsed.value.by) : []).toEqual(["x0", "x1"]);
    expect(S.parse(out).ok).toBe(true);
    expect(JSON.stringify(out)).toContain('"a"');
  });

  test("a later error is scrubbed of a key", () => {
    const r = redactionOf([], 7);
    r.state("u", S, { by: { "bob@example.com": 3 }, open: {} });
    const e = r.error({ code: "x.y", message: "no bob@example.com", data: { at: "a", k: "bob@example.com" } });
    expect(JSON.stringify(e)).not.toContain("bob@");
  });
});

describe("error scrub forms", () => {
  const E = s.object({ email: s.string().pii("contact"), by: s.string().pii("name") });
  const run = (message: string) => {
    const r = redactionOf([], 7);
    r.state("u", E, { email: "carol@example.com", by: "JD" });
    return r.error({ code: "x.y", message, data: { at: "a", note: message } });
  };
  test("case, URL-encoded and JSON-escaped forms, and a short value as a whole token", () => {
    const e = JSON.stringify(run("CAROL@EXAMPLE.COM carol%40example.com carol@example.com jd and JD, not JDK or adjd"));
    expect(e).not.toMatch(/carol/i);
    expect(e).not.toMatch(/example/i);
    expect(e).toContain("JDK");
    expect(e).toContain("adjd");
    expect(e).not.toMatch(/\bjd\b/i);
  });
  test("a JSON-escaped value", () => {
    const r = redactionOf([], 7);
    r.state("u", s.object({ a: s.string().pii("location") }), { a: 'Flat "2"\n1 Main St' });
    const e = r.error({ code: "x.y", message: JSON.stringify({ a: 'Flat "2"\n1 Main St' }), data: { at: "a" } });
    expect(e.message).not.toContain("Main");
  });
});
