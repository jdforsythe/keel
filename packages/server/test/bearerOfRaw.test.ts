// bearerOf (k.api Bearer) on header values exactly as given. A `Headers` object already trims a value, so these cases
// hand `bearerOf` a request whose header lookup answers with the raw string, to hold the function's own trim: spaces
// and horizontal tabs only, at both ends, in any amount. Every case loads a fresh copy of the module.
import { describe, expect, it, vi } from "vitest";

class Raw extends Headers {
  readonly #value: string | null;
  constructor(value: string | null) {
    super();
    this.#value = value;
  }
  override get(): string | null {
    return this.#value;
  }
}

async function read(value: string | null): Promise<string | undefined> {
  vi.resetModules();
  const { bearerOf } = await import("../src/internal/bearerOf.ts");
  const { reveal } = await import("@keel/schema");
  const req = new Request("http://localhost/api/x");
  Object.defineProperty(req, "headers", { value: new Raw(value) });
  const b = bearerOf(req);
  return b === undefined ? undefined : reveal(b);
}

describe("bearerOf on raw header values", () => {
  it("strips any run of spaces and tabs at either end", async () => {
    expect(await read("Bearer abc")).toBe("abc");
    expect(await read(" Bearer abc")).toBe("abc");
    expect(await read("Bearer abc ")).toBe("abc");
    expect(await read("\tBearer abc")).toBe("abc");
    expect(await read("Bearer abc\t")).toBe("abc");
    expect(await read("  \t \tBearer abc \t  \t")).toBe("abc");
    expect(await read(" \t Bearer a \t ")).toBe("a");
  });

  it("keeps a trailing `=` run of the token and strips whitespace after it", async () => {
    expect(await read("Bearer abc= ")).toBe("abc=");
    expect(await read("Bearer a== \t")).toBe("a==");
  });

  it("reads nothing from an absent header or one holding only spaces and tabs", async () => {
    expect(await read(null)).toBeUndefined();
    expect(await read("")).toBeUndefined();
    expect(await read(" ")).toBeUndefined();
    expect(await read("\t")).toBeUndefined();
    expect(await read("  \t  ")).toBeUndefined();
    expect(await read("Bearer ")).toBeUndefined();
    expect(await read(" Bearer ")).toBeUndefined();
    expect(await read("Bearer \t")).toBeUndefined();
  });

  it("does not strip other whitespace, and a stripped value still has to match whole", async () => {
    expect(await read(" Bearer abc")).toBeUndefined();
    expect(await read("Bearer abc ")).toBeUndefined();
    expect(await read("\u000bBearer abc")).toBeUndefined();
    expect(await read("Bearer abc\n")).toBeUndefined();
    expect(await read("   Bearer abc")).toBeUndefined();
    expect(await read("Bearer abc  ")).toBeUndefined();
    expect(await read("xBearer abc")).toBeUndefined();
    expect(await read("Bearer abc!")).toBeUndefined();
    expect(await read("Bearer abc def")).toBeUndefined();
  });

  it("matches the scheme in any letter case, then one or more spaces, then 1 to 4,096 token characters", async () => {
    expect(await read("bEaReR abc")).toBe("abc");
    expect(await read("Bearer     abc")).toBe("abc");
    expect(await read("Bearer\tabc")).toBeUndefined();
    expect(await read("Bearerabc")).toBeUndefined();
    expect(await read("Bearer a")).toBe("a");
    expect(await read("Bearer ab")).toBe("ab");
    expect(await read(`Bearer ${"a".repeat(4096)}`)).toBe("a".repeat(4096));
    expect(await read(`Bearer ${"a".repeat(4097)}`)).toBeUndefined();
    expect(await read(`Bearer ${"a".repeat(4096)}==`)).toBe(`${"a".repeat(4096)}==`);
  });

  it("accepts every token68 character and refuses the characters around them", async () => {
    const all = "AZaz09-._~+/";
    expect(await read(`Bearer ${all}`)).toBe(all);
    expect(await read(`Bearer ${all}=`)).toBe(`${all}=`);
    for (const c of ["=", "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", ",", ";", ":", '"', "'", "\\", "|", "<", ">", "?"])
      expect(await read(`Bearer a${c}`), c).toBe(c === "=" ? "a=" : undefined);
    expect(await read("Bearer =a")).toBeUndefined();
    expect(await read("Bearer a=b")).toBeUndefined();
    expect(await read("Bearer =")).toBeUndefined();
  });

  it("gives the Secret marker, never the token, in String and JSON forms", async () => {
    vi.resetModules();
    const { bearerOf } = await import("../src/internal/bearerOf.ts");
    const { reveal } = await import("@keel/schema");
    const req = new Request("http://localhost/api/x", { headers: { authorization: "Bearer tok-1" } });
    const b = bearerOf(req);
    expect(String(b)).toBe("[secret]");
    expect(JSON.stringify({ b })).toBe('{"b":"[secret]"}');
    expect(b === undefined ? undefined : reveal(b)).toBe("tok-1");
  });
});
