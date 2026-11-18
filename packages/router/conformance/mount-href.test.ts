// @vitest-environment happy-dom
// Spec: k.mount, Declaration "`identity.ts` beside `topology.ts` default-exports `identityMount(path)` (`@keel/router`): `{ path, href }`, `path` a literal of lowercase `/` segments."
// Spec: k.mount, Declaration "`href(subpath?, search?)` returns a `MountHref`, an `Href` (k.router): `path`, `subpath`, then `?` and the `search` string map's keys sorted, keys and values encoded by `encodeURIComponent`; no `?` for an empty map. `subpath` is `''` or `/`-led segments of `[A-Za-z0-9._~-]`, none `.` or `..`; else (`//`, `..`, `?`, `#`, `%`, `\`, a scheme) it throws E1582. So the result is a root-relative path under `path`, never absolute or protocol-relative."
// Spec: k.mount, Conformance "With `path` `/api/auth`, `href('/sign-in/email', { b: '2', a: 'x y' })` is `/api/auth/sign-in/email?a=x%20y&b=2` and `href()` is `/api/auth`; `'//x.example'`, `'/../x'`, `'/a/..'`, `'/a?b'`, `'/a#b'`, `'/a%2f'` and `'https://x'` each throw E1582."
// Spec: k.mount, Form "`method` must be `'POST'` when `action` is a `MountHref` (a type error otherwise)."
// Spec: k.mount, Navigation "`Link to`, `navigate` and an action's `ok(href)` take it as any `Href`."
// Seed 1337 (fc.assert below). `Link to` is checked at run time in packages/testing/conformance/mount-navigation.test.ts (the router package does not depend on @keel/ui). The type clauses are expectTypeOf assertions with the `.not` forms (no suppression comments).
import {
  type Form,
  type FormProps,
  type Href,
  type MountHref,
  action,
  identityMount,
  type navigate,
} from "@keel/router";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { MOUNT_PATH, SEED, SEGMENT_CHARS, mount, thrownCode } from "./mount-support.ts";

const RUNS = 200;
const segment = fc
  .stringMatching(new RegExp(`^[${SEGMENT_CHARS.replace("-", "\\-")}]{1,8}$`))
  .filter((v) => v !== "." && v !== "..");
const subpaths = fc.array(segment, { minLength: 1, maxLength: 4 }).map((parts) => `/${parts.join("/")}`);
const lowerSegment = fc.stringMatching(/^[a-z][a-z0-9-]{0,7}$/);
const encode = encodeURIComponent;

describe("k.mount: identityMount declares the mount path and mints its Hrefs", () => {
  it("identityMount(path) gives { path, href } with `path` as written, for generated lowercase `/` segment paths", () => {
    fc.assert(
      fc.property(fc.array(lowerSegment, { minLength: 1, maxLength: 4 }), (parts) => {
        const path = `/${parts.join("/")}`;
        const made = identityMount(path);
        expect(made.path).toBe(path);
        expect(typeof made.href).toBe("function");
        expect(made.href()).toBe(path);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("the mount's `href()` is a MountHref, an Href, so it is a value `Link to`, `navigate` and `ok` take", () => {
    expectTypeOf(mount.href()).toExtend<MountHref>();
    expectTypeOf<MountHref>().toExtend<Href>();
    expect(typeof mount.href()).toBe("string");
  });

  it("`navigate` takes a MountHref, and an action's `ok(href)` of one compiles unannotated", () => {
    expectTypeOf(mount.href("/x")).toExtend<Parameters<typeof navigate>[0]>();
    const answer = action({ input: s.object({}) }, async () => ok(mount.href("/x")));
    expect(typeof answer).toBe("function");
  });
});

describe("k.mount: href(subpath?, search?)", () => {
  it("with `path` `/api/auth`, href('/sign-in/email', { b: '2', a: 'x y' }) is /api/auth/sign-in/email?a=x%20y&b=2 and href() is /api/auth", () => {
    expect(mount.href("/sign-in/email", { b: "2", a: "x y" })).toBe("/api/auth/sign-in/email?a=x%20y&b=2");
    expect(mount.href()).toBe("/api/auth");
  });

  it("'//x.example', '/../x', '/a/..', '/a?b', '/a#b', '/a%2f' and 'https://x' each throw E1582", () => {
    for (const bad of ["//x.example", "/../x", "/a/..", "/a?b", "/a#b", "/a%2f", "https://x"]) {
      expect(thrownCode(() => mount.href(bad))).toBe("E1582");
    }
  });

  it("a `.` segment, an empty segment, a backslash, a colon, a missing leading `/` and non-ASCII are refused with E1582", () => {
    for (const bad of ["/a/./b", "/./a", "/a//b", "a", "/a\\b", "/a:b", "/café", "/∕x", "/a b", "/a\u0000"]) {
      expect(thrownCode(() => mount.href(bad))).toBe("E1582");
    }
  });

  it("every accepted subpath yields a root-relative path under the mount path, never absolute or protocol-relative", () => {
    fc.assert(
      fc.property(subpaths, (sub) => {
        const out = mount.href(sub);
        expect(out).toBe(`${MOUNT_PATH}${sub}`);
        expect(out.startsWith("/")).toBe(true);
        expect(out.startsWith("//")).toBe(false);
        expect(out).not.toContain("?");
        const parsed = new URL(out, "http://page.test");
        expect(parsed.origin).toBe("http://page.test");
        expect(parsed.pathname).toBe(out);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("an empty subpath, with or without an empty search map, is the mount path alone and carries no `?`", () => {
    expect(mount.href("")).toBe(MOUNT_PATH);
    expect(mount.href("", {})).toBe(MOUNT_PATH);
    expect(mount.href("/x", {})).toBe(`${MOUNT_PATH}/x`);
  });

  it("every subpath holding a character outside [A-Za-z0-9._~-] and `/` is refused with E1582", () => {
    const bad = fc.constantFrom("?", "#", "%", "\\", ":", " ", "é", "∕", "@", "&", "=", "+", ";", "\n");
    fc.assert(
      fc.property(subpaths, bad, fc.nat(), (sub, ch, at) => {
        const i = at % (sub.length + 1);
        const mangled = `${sub.slice(0, i)}${ch}${sub.slice(i)}`;
        // A leading character before the first `/` also breaks the `/`-led form; either way the call throws.
        expect(thrownCode(() => mount.href(mangled))).toBe("E1582");
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("every subpath with a `.` or `..` segment, a `//`, or no leading `/` is refused with E1582", () => {
    const dots = fc.constantFrom(".", "..");
    fc.assert(
      fc.property(subpaths, dots, (sub, dot) => {
        expect(thrownCode(() => mount.href(`${sub}/${dot}`))).toBe("E1582");
        expect(thrownCode(() => mount.href(`/${dot}${sub}`))).toBe("E1582");
        expect(thrownCode(() => mount.href(`/${dot}`))).toBe("E1582");
        expect(thrownCode(() => mount.href(`/${sub}`))).toBe("E1582");
        expect(thrownCode(() => mount.href(sub.slice(1)))).toBe("E1582");
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("the search map's keys are sorted and keys and values are encoded by encodeURIComponent, whatever the characters", () => {
    const text = fc.string({ maxLength: 8 });
    fc.assert(
      fc.property(
        fc.dictionary(fc.stringMatching(/^[A-Za-z0-9]{1,6}$/), text, { minKeys: 1, maxKeys: 5 }),
        subpaths,
        (map, sub) => {
          const keys = Object.keys(map).sort();
          const expected = `${MOUNT_PATH}${sub}?${keys.map((k) => `${encode(k)}=${encode(map[k] ?? "")}`).join("&")}`;
          expect(mount.href(sub, map)).toBe(expected);
        },
      ),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("a search key or value holding `/`, `?`, `#`, `&`, `=`, `%` or a space stays in the query and round-trips", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 10 }), fc.string({ maxLength: 10 }), (key, value) => {
        const out = mount.href("/x", { [key]: value });
        const url = new URL(out, "http://page.test");
        expect(url.origin).toBe("http://page.test");
        expect(url.pathname).toBe(`${MOUNT_PATH}/x`);
        expect(url.hash).toBe("");
        expect([...url.searchParams.entries()]).toEqual([[key, value]]);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("equal inputs give equal output whatever the order the search keys were written in", () => {
    expect(mount.href("/x", { b: "1", a: "2", c: "3" })).toBe(mount.href("/x", { c: "3", a: "2", b: "1" }));
  });
});

describe("k.mount: a Form whose action is a MountHref takes method POST only", () => {
  type Props = Parameters<typeof Form>[0];
  const children = (): Node[] => [];

  it("`method: 'POST'` with a MountHref action typechecks and any other method does not", () => {
    expectTypeOf<{ method: "POST"; action: MountHref; children: typeof children }>().toExtend<Props>();
    for (const verb of ["PUT", "PATCH", "DELETE"] as const) {
      expectTypeOf<{ method: typeof verb; action: MountHref; children: typeof children }>().not.toExtend<Props>();
    }
    expectTypeOf<FormProps<MountHref>["method"]>().toEqualTypeOf<"POST">();
  });

  it("the search map takes string values only", () => {
    type Search = NonNullable<Parameters<typeof mount.href>[1]>;
    expectTypeOf<Record<string, string>>().toExtend<Search>();
    expectTypeOf<{ a: number }>().not.toExtend<Search>();
    expectTypeOf<{ a: string[] }>().not.toExtend<Search>();
  });
});
