// @vitest-environment happy-dom
// Spec: k.mount, Form "A `<Form>` whose `action` no enclosing router matches, or with no router, submits natively; `method` must be `'POST'` when `action` is a `MountHref` (a type error otherwise). On `submit` it validates its `form` handle: errors show (k.forms) and the submit is prevented; else `pending()` is `true` and the browser posts `application/x-www-form-urlencoded` the form's named controls and the submitter's, Keel adding none. A chosen file throws E1583 and nothing is sent. `pending()` is `false` again on a `pageshow` from the back-forward cache."
// Spec: k.mount, Form "`.pii()` and `s.secret` fields go in the body as typed, to the page's own origin only; Keel logs no body. A URL lands in history and access logs, so none goes in `search`."
// Spec: k.mount, Conformance "A `Form` POST to it with invalid input shows the errors and records nothing; valid, one POST whose body is exactly the named fields, no `_method`, with `pending()` `true`."
// Spec: k.mount, Conformance "E1580, E1581 and E1582 each have a triggering fixture and a clean one; a chosen file is E1583, nothing recorded."
// Seed 1337 (fc.assert below). The `method` type clause is in packages/router/conformance/mount-href.test.ts; `Keel logs no body` is in packages/server/conformance/mount-server.test.ts.
// Untestable: "and the submitter's" (name and value in the body): `Button` of `@keel/ui` takes no `name` or `value`, so no page can express a named submitter.
// The sign-in page of mount-pages.ts shows `pending()` in `mt.signin.pending` and the keys of `errors()` in `mt.signin.errors`; its submit button is clicked, which submits the form with the button as submitter.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { INVALID, SEED, VALID, chooseFile, closeAll, open, pageshow, ticks } from "./mount-pages.ts";

afterEach(closeAll);

type Handle = Awaited<ReturnType<typeof open>>;

async function fill(h: Handle, email: string, password: string): Promise<void> {
  await h.fire("mt.signin.email", { type: "input", value: email });
  await h.fire("mt.signin.password", { type: "input", value: password });
}
const typed = fc.stringMatching(/^[a-z0-9@.+&=%]{3,12}$/).filter((v) => v === v.trim());
const secret = fc.stringMatching(/^[a-z0-9&=%+]{2,12}$/);

describe("k.mount: a Form to the mount validates, then lets the browser post", () => {
  it("invalid input shows the errors, prevents the submit, records nothing and leaves `pending()` false", async () => {
    const h = await open("mt.signin");
    await fill(h, INVALID.email, INVALID.password);
    await h.fire("mt.signin.submit", { type: "click" });
    expect(h.find("mt.signin.errors").text).toContain("email");
    expect(h.find("mt.signin.pending").text).toBe("false");
    expect(h.documents()).toEqual([]);
    h.dispose();
  });

  it("valid input records one POST whose body is exactly the two named fields, with `pending()` true", async () => {
    const h = await open("mt.signin");
    await fill(h, VALID.email, VALID.password);
    await h.fire("mt.signin.submit", { type: "click" });
    expect(h.documents()).toEqual([
      { method: "POST", url: "/api/auth/sign-in/email", body: "email=a%40b.example&password=pw" },
    ]);
    expect(h.find("mt.signin.pending").text).toBe("true");
    h.dispose();
  });

  it("the body has no `_method` and no field the form does not hold, and is urlencoded text", async () => {
    const h = await open("mt.signin");
    await fill(h, VALID.email, VALID.password);
    await h.fire("mt.signin.submit", { type: "click" });
    const [entry] = h.documents();
    const body = entry?.body ?? "";
    expect([...new URLSearchParams(body).keys()]).toEqual(["email", "password"]);
    expect(body).not.toContain("_method");
    expect(body).not.toContain("multipart");
    h.dispose();
  });

  it("`.pii()` and `s.secret` fields go in the body as typed, whatever characters they hold, to a root-relative URL with no search", async () => {
    await fc.assert(
      fc.asyncProperty(typed, secret, async (email, password) => {
        const h = await open("mt.signin");
        await fill(h, email, password);
        await h.fire("mt.signin.submit", { type: "click" });
        const [entry] = h.documents();
        expect(h.documents()).toHaveLength(1);
        expect(entry?.method).toBe("POST");
        const url = entry?.url ?? "";
        expect(url.startsWith("/")).toBe(true);
        expect(url.startsWith("//")).toBe(false);
        expect(url).not.toContain("?");
        expect(url.split("/").filter((part) => part !== "")).toEqual(["api", "auth", "sign-in", "email"]);
        const fields = [...new URLSearchParams(entry?.body ?? "").entries()];
        expect(fields).toEqual([
          ["email", email],
          ["password", password],
        ]);
        h.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("`pending()` is false again on a `pageshow` from the back-forward cache, and a plain `pageshow` leaves it true", async () => {
    const h = await open("mt.signin");
    await fill(h, VALID.email, VALID.password);
    await h.fire("mt.signin.submit", { type: "click" });
    expect(h.find("mt.signin.pending").text).toBe("true");
    pageshow(false);
    await ticks();
    expect(h.find("mt.signin.pending").text).toBe("true");
    pageshow(true);
    await ticks();
    expect(h.find("mt.signin.pending").text).toBe("false");
    h.dispose();
  });

  it("a restored page can post again: the valid submit after the `pageshow` records a second POST", async () => {
    const h = await open("mt.signin");
    await fill(h, VALID.email, VALID.password);
    await h.fire("mt.signin.submit", { type: "click" });
    pageshow(true);
    await ticks();
    await h.fire("mt.signin.submit", { type: "click" });
    expect(h.documents()).toHaveLength(2);
    h.dispose();
  });
});

describe("k.mount: E1583 a native submit with a file chosen", () => {
  const rejected = async (run: () => Promise<unknown>): Promise<unknown> => {
    try {
      await run();
      return null;
    } catch (e) {
      return typeof e === "object" && e !== null && "code" in e ? e.code : "no-code";
    }
  };

  it("a chosen file throws E1583 at submit and nothing is recorded", async () => {
    const h = await open("mt.upload");
    chooseFile("mt.upload.file");
    expect(await rejected(() => h.fire("mt.upload.form", { type: "submit" }))).toBe("E1583");
    expect(h.documents()).toEqual([]);
    h.dispose();
  });

  it("the same form with no file chosen does not throw and records one POST", async () => {
    const h = await open("mt.upload");
    await h.fire("mt.upload.note", { type: "input", value: "hi" });
    expect(await rejected(() => h.fire("mt.upload.form", { type: "submit" }))).toBeNull();
    const [entry] = h.documents();
    expect(h.documents()).toHaveLength(1);
    expect(entry?.method).toBe("POST");
    expect(entry?.url).toBe("/api/auth/upload");
    h.dispose();
  });
});
