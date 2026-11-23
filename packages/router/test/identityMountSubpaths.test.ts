// k.mount Declaration: the paths, subpaths and links an identity mount takes (E1580, E1582, E1584 otherwise) and the
// href it writes: the path, the subpath, then the search with its keys sorted and encoded.
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

const SEED = 1337;
const messageOf = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return null;
};
/** `identityMount` and the set of mounts made, of a router loaded afresh. */
const fresh = async () => {
  vi.resetModules();
  const { identityMount } = await import("../src/identityMount.ts");
  const { identityMounts } = await import("../src/internal/index.ts");
  return { identityMount, identityMounts };
};

const GOOD = [
  "",
  "/a",
  "/ab",
  "/a/b",
  "/sign-in",
  "/a.b~c-d_e",
  "/A1/b2",
  "/...",
  "/.a",
  "/a.",
  "/..a",
  "/a..",
  "/.x/..y",
];
const BAD = [
  "a",
  "a/b",
  "/",
  "/a/",
  "//a",
  "/a//b",
  "/a b",
  "/a?",
  "/a#b",
  "/é",
  "/.",
  "/..",
  "/./a",
  "/../a",
  "/a/.",
  "/a/..",
  "/a/./b",
  "/a/../b",
  "/a%2Fb",
];

describe("identityMount", () => {
  it("href takes a subpath of url-safe segments, none . or ..", async () => {
    const { identityMount } = await fresh();
    const mount = identityMount("/api/auth");
    for (const sub of GOOD) expect(mount.href(sub), sub).toBe(`/api/auth${sub}`);
    for (const sub of BAD)
      expect(
        messageOf(() => mount.href(sub)),
        sub,
      ).toBe(`E1582 href subpath ${JSON.stringify(sub)}`);
    expect(mount.href()).toBe("/api/auth");
  });

  it("href writes the search after the subpath, keys sorted, keys and values encoded", async () => {
    const { identityMount } = await fresh();
    const mount = identityMount("/auth");
    expect(mount.href("/x", { b: "1", a: "2 3", "c d": "é&=" })).toBe("/auth/x?a=2%203&b=1&c%20d=%C3%A9%26%3D");
    expect(mount.href("", { next: "/a?b=1" })).toBe("/auth?next=%2Fa%3Fb%3D1");
    expect(mount.href("/x", {})).toBe("/auth/x");
    fc.assert(
      fc.property(fc.shuffledSubarray(["a", "b", "c", "d"], { minLength: 1 }), (keys) => {
        const search = Object.fromEntries(keys.map((k) => [k, k.toUpperCase()]));
        const sorted = [...keys].sort().map((k) => `${k}=${k.toUpperCase()}`);
        expect(mount.href("/s", search)).toBe(`/auth/s?${sorted.join("&")}`);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("links are subpaths of that form, none empty and none repeated", async () => {
    const { identityMount } = await fresh();
    const links = GOOD.filter((sub) => sub !== "");
    expect(identityMount("/auth", { links }).links).toEqual(links);
    expect(identityMount("/auth").links).toEqual([]);
    for (const sub of ["", ...BAD])
      expect(
        messageOf(() => identityMount("/auth", { links: ["/ok", sub] })),
        sub,
      ).toBe(`E1584 links ${JSON.stringify(sub)}`);
    expect(messageOf(() => identityMount("/auth", { links: ["/a", "/b", "/a"] }))).toBe('E1584 links "/a"');
  });

  it("E1580 for a path that is not lowercase slash-led segments", async () => {
    const { identityMount } = await fresh();
    for (const path of ["", "/", "auth", "/Auth", "/auth/", "/a_b", "/a.b", "//a", "/a b"]) {
      const thrown = (() => {
        try {
          identityMount(path);
        } catch (e) {
          return e;
        }
        return null;
      })();
      expect(thrown instanceof Error ? thrown.message : null, path).toBe("E1580 path");
      expect(Reflect.get(Object(thrown), "code")).toBe("E1580");
    }
    for (const path of ["/auth", "/api/auth", "/a-b/c9"]) expect(identityMount(path).path).toBe(path);
  });

  it("every mount made is among the process's identity mounts", async () => {
    const { identityMount, identityMounts } = await fresh();
    expect(identityMounts.size).toBe(0);
    const one = identityMount("/one");
    const two = identityMount("/two", { links: ["/back"] });
    expect([...identityMounts]).toEqual([one, two]);
    expect(messageOf(() => identityMount("/Bad"))).toBe("E1580 path");
    expect(identityMounts.size).toBe(2);
  });
});
