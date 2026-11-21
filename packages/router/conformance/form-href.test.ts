// @vitest-environment happy-dom
// Spec: k.router, clause "Outside any router a `Form` renders `action` unchanged and lets submit through; inside one, an `action` route lacking `method` throws E1505." (RFC 0045)
// Outside a router the call is made directly (no mount of a router); inside one, through the probe in fixtures.ts.
// Property seed: 1337.
import { Form } from "@keel/router";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, VERBS, idOf, probeForm, probeLinks, usableId } from "./fixtures.ts";

const idArb = fc.string({ minLength: 1, maxLength: 8 }).filter(usableId);

describe("k.router Form outside and inside a router", () => {
  it("outside any router a Form renders action unchanged, for every verb and generated id", () => {
    fc.assert(
      fc.property(fc.constantFrom(...VERBS), idArb, (verb, raw) => {
        const href = probeLinks.href("link.show", { id: idOf(raw) });
        const node = Form({ method: verb, action: href, children: () => [] });
        expect(node.tagName).toBe("FORM");
        expect(node.getAttribute("action")).toBe(href);
        expect(node.getAttribute("method")?.toLowerCase()).toBe("post");
        const hidden = node.querySelector('input[name="_method"]');
        if (verb === "POST") expect(hidden).toBeNull();
        else expect(hidden?.getAttribute("value")).toBe(verb);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("outside any router a Form does not intercept submit and never throws E1505", () => {
    // A route the Form's action does not match, and a verb nothing declares: still no throw outside a router.
    const ghost = probeLinks.href("link.ghost");
    for (const verb of VERBS) {
      const node = Form({ method: verb, action: ghost, children: () => [] });
      document.body.append(node);
      const ev = new Event("submit", { bubbles: true, cancelable: true });
      node.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
      node.remove();
    }
  });

  it("inside a router an action whose matched route lacks method throws E1505", async () => {
    const href = probeLinks.href("link.show", { id: idOf("1") });
    for (const verb of VERBS) {
      expect(await probeForm(verb, href)).toBe(verb === "POST" ? null : "E1505");
    }
  });

  it("inside a router an action that matches no route does not throw: the browser posts it", async () => {
    expect(await probeForm("POST", probeLinks.href("link.ghost"))).toBeNull();
  });
});
