// @vitest-environment node
// k.privacy Server log: the written forms of a secret the scrub marks. Besides the value as written, JSON-escaped,
// URL-encoded and base64, a copy is marked form-encoded (`+` for a space, as `URLSearchParams` writes it), encoded by
// `encodeURI` as a URL path, URL-encoded twice, JSON-escaped with `\u` for each non-ASCII unit, and JSON-escaped twice
// (JSON inside a JSON string). Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { scrubbed } from "../src/internal/scrubbed.ts";

const one = (m: string, v: string): string => scrubbed(m, [[new Set([v]), "[secret]"]]);
const asciiJson = (v: string): string =>
  JSON.stringify(v)
    .slice(1, -1)
    .replace(/[^\0-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
const SECRET = 'pa ss/wörd?&="\\ 漢';

describe("other encodings of a secret", () => {
  it("marks a form-encoded copy, `+` for each space", () => {
    const form = `${new URLSearchParams([["k", SECRET]])}`.slice(2);
    expect(form).toContain("+");
    expect(one(`body k=${form}&x=1`, SECRET)).toBe("body k=[secret]&x=1");
    expect(one("q=two+words+here", "two words here")).toBe("q=[secret]");
  });

  it("marks an encodeURI copy, as a URL path writes it", () => {
    const path = encodeURI(`/reset/${SECRET}`);
    expect(one(`GET ${path}`, SECRET)).toBe("GET /reset/[secret]");
    expect(one(`GET /f/${encodeURI("a/b c")}`, "a/b c")).toBe("GET /f/[secret]");
  });

  it("marks a copy URL-encoded twice", () => {
    expect(one(`next=${encodeURIComponent(encodeURIComponent(SECRET))}`, SECRET)).toBe("next=[secret]");
  });

  it("marks a JSON copy with `\\u` for each non-ASCII unit, in either case", () => {
    expect(one(`{"k":"${asciiJson(SECRET)}"}`, SECRET)).toBe('{"k":"[secret]"}');
    const upper = asciiJson(SECRET).replace(/\\u([0-9a-f]{4})/g, (_, h: string) => `\\u${h.toUpperCase()}`);
    expect(upper).not.toBe(asciiJson(SECRET));
    expect(one(`{"k":"${upper}"}`, SECRET)).toBe('{"k":"[secret]"}');
    expect(one(`{"k":"${asciiJson("😀 émoji")}"}`, "😀 émoji")).toBe('{"k":"[secret]"}');
  });

  it("marks a copy JSON-escaped twice, JSON inside a JSON string", () => {
    const inner = JSON.stringify({ k: SECRET });
    expect(one(JSON.stringify({ body: inner }), SECRET)).toBe('{"body":"{\\"k\\":\\"[secret]\\"}"}');
  });

  it("marks every listed form of any string of at least 3 units, wherever it stands", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 3, unit: "binary" }), (v) => {
        const forms = [v, JSON.stringify(v).slice(1, -1), JSON.stringify(JSON.stringify(v)).slice(1, -1), asciiJson(v)];
        if (!/[\uD800-\uDFFF]/.test(v))
          forms.push(
            encodeURIComponent(v),
            encodeURI(v),
            encodeURIComponent(encodeURIComponent(v)),
            `${new URLSearchParams([["", v]])}`.slice(1),
          );
        for (const f of forms) {
          const out = one(`<${f}>`, v);
          expect(out).toContain("[secret]");
          if (!"<[secret]>".includes(f)) expect(out).not.toContain(f);
        }
      }),
      { seed: 1337, numRuns: 300 },
    );
  });
});
