// A group user's cookie jar keeps what a browser would for a sim origin: deletion by `Max-Age=0` or a past `Expires`
// on the sim clock, `Path`, `Secure` against the request's scheme, and the `__Host-` and `__Secure-` prefix rules.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { cookieJar } from "../src/group/internal/cookieJar.ts";

const HTTP = "http://group.test";
const HTTPS = "https://group.test";

describe("group cookie jar", () => {
  test("a cookie is sent back; a later Set-Cookie of the name replaces it", () => {
    const jar = cookieJar(() => 0);
    jar.store(`${HTTP}/api/a`, ["keel-caller=one; Path=/; HttpOnly; SameSite=Lax"]);
    expect(jar.header(`${HTTP}/x`)).toBe("keel-caller=one");
    jar.store(`${HTTP}/api/a`, ["keel-caller=two; Path=/"]);
    expect(jar.header(`${HTTP}/`)).toBe("keel-caller=two");
  });

  test("Max-Age=0 and a past Expires delete; Max-Age runs out on the sim clock", () => {
    let now = 1_000;
    const jar = cookieJar(() => now);
    jar.store(HTTP, ["a=1; Path=/", "b=2; Path=/", "c=3; Path=/; Max-Age=10"]);
    jar.store(HTTP, ["a=; Path=/; Max-Age=0", "b=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]);
    expect(jar.header(HTTP)).toBe("c=3");
    now = 11_000;
    expect(jar.header(HTTP)).toBe("");
  });

  test("Path limits where a cookie goes; the default path is the request's directory", () => {
    const jar = cookieJar(() => 0);
    jar.store(`${HTTP}/api/lists/new`, ["d=1", "p=2; Path=/api"]);
    expect(jar.header(`${HTTP}/api/lists/x`)).toBe("d=1; p=2");
    expect(jar.header(`${HTTP}/api`)).toBe("p=2");
    expect(jar.header(`${HTTP}/apix`)).toBe("");
  });

  test("Secure cookies are set and sent over https only", () => {
    const jar = cookieJar(() => 0);
    jar.store(HTTP, ["s=1; Path=/; Secure"]);
    expect(jar.header(HTTPS)).toBe("");
    jar.store(HTTPS, ["s=2; Path=/; Secure"]);
    expect(jar.header(HTTP)).toBe("");
    expect(jar.header(HTTPS)).toBe("s=2");
  });

  test("__Host- needs Secure, https, Path=/ and no Domain; __Secure- needs Secure and https", () => {
    const jar = cookieJar(() => 0);
    jar.store(HTTP, ["__Host-a=1; Path=/; Secure", "__Secure-b=1; Path=/; Secure"]);
    jar.store(HTTPS, [
      "__Host-c=1; Path=/api; Secure",
      "__Host-d=1; Path=/; Secure; Domain=group.test",
      "__Host-e=1; Path=/",
      "__Secure-f=1; Path=/",
      "__Host-keel-caller=ok; Path=/; HttpOnly; SameSite=Lax; Secure",
      "__Secure-g=ok; Path=/; Secure",
    ]);
    expect(jar.header(`${HTTPS}/api`)).toBe("__Host-keel-caller=ok; __Secure-g=ok");
  });

  test("property: a cookie deleted by Max-Age=0 is never sent", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,8}$/), fc.stringMatching(/^[a-z0-9]{0,8}$/), (name, value) => {
        const jar = cookieJar(() => 0);
        jar.store(HTTP, [`${name}=${value}; Path=/`]);
        jar.store(HTTP, [`${name}=; Path=/; Max-Age=0`]);
        expect(jar.header(HTTP)).toBe("");
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
