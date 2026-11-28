import { deployableNameProblem } from "@keel/compiler/hosting/deployableNameProblem";
import { peerKey } from "@keel/compiler/hosting/peerKey";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const name = fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/);

describe("peerKey (k.topology Build)", () => {
  test("`my-api` gives `KEEL_PEER_MY_API`", () => {
    expect(peerKey("my-api")).toBe("KEEL_PEER_MY_API");
    expect(peerKey("api")).toBe("KEEL_PEER_API");
  });

  test("every valid name gives a key matching ^KEEL_PEER_[A-Z][A-Z0-9_]*$", () => {
    fc.assert(
      fc.property(name, (n) => {
        expect(deployableNameProblem(n)).toBeUndefined();
        expect(peerKey(n)).toMatch(/^KEEL_PEER_[A-Z][A-Z0-9_]*$/);
      }),
      { seed: 1337, numRuns: 200 },
    );
  });

  test("distinct valid names give distinct keys; `a_b`, which would collide with `a-b`, is not a valid name", () => {
    expect(peerKey("a-b")).toBe(peerKey("a_b"));
    expect(deployableNameProblem("a_b")).toBeDefined();
    fc.assert(
      fc.property(name, name, (a, b) => {
        fc.pre(a !== b);
        expect(peerKey(a)).not.toBe(peerKey(b));
      }),
      { seed: 1337, numRuns: 200 },
    );
  });
});
