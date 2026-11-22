// @vitest-environment happy-dom
// Spec: k.forms, Conformance "A no-script post that fails `amount` (an `Input` labelled `Amount`) answers 422 with a `.k-summary` item reading `Amount: <message>` whose link targets `#<field id>`."
// Spec: k.forms, "The page carries a summary before its content, `role="alert"` with class `k-summary` (k.ui Base): one item per error, a link to the field's control (`#<field id>`) named by the text of its `<label for>` (else the path), then the message."
// Seed: 1337 (property over labels).
// Not built yet: every case is `test.skip`; the builder changes `test.skip` to `test` in each.
// Assumed: an item is a list item holding one link and then the message; its text, whitespace collapsed, is `<link text>: <message>`, and `<message>` is the text of the element the control's `aria-describedby` names.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FIELD_ID, appFor, postEmpty } from "./label-summary-routes.ts";

const label = fc
  .array(fc.constantFrom(..."ABCDEFGHJKMNPQRSTUVWXYZ"), { minLength: 1, maxLength: 1 })
  .chain((head) =>
    fc
      .array(fc.constantFrom(..."abcdefghjkmnpqrstuvwxyz"), { minLength: 3, maxLength: 8 })
      .map((rest) => head.join("") + rest.join("")),
  )
  .filter((w) => w.toLowerCase() !== "amount");

async function served(text: string): Promise<{ status: number; doc: Document }> {
  const app = await appFor(text);
  const res = await app.fetch(postEmpty());
  return { status: res.status, doc: new DOMParser().parseFromString(await res.text(), "text/html") };
}
const collapse = (t: string | null): string => (t ?? "").replace(/\s+/g, " ").trim();
const messageOf = (doc: Document): string => {
  const describedBy = doc.getElementById(FIELD_ID)?.getAttribute("aria-describedby") ?? "";
  return collapse(doc.getElementById(describedBy)?.textContent ?? "");
};

describe("k.forms: the no-script 422 summary names the field's label, not its path", () => {
  it.skip("a post failing `amount` (an `Input` labelled `Amount`) answers 422 with a `.k-summary` item reading `Amount: <message>` whose link targets `#<field id>`", async () => {
    const { status, doc } = await served("Amount");
    expect(status).toBe(422);
    const summary = doc.querySelector(".k-summary");
    expect(summary).not.toBeNull();
    const message = messageOf(doc);
    expect(message.length).toBeGreaterThan(0);
    const items = Array.from(summary?.querySelectorAll("li") ?? []);
    expect(items).toHaveLength(1);
    expect(collapse(items[0]?.textContent ?? "")).toBe(`Amount: ${message}`);
    expect(items[0]?.querySelector("a")?.getAttribute("href")).toBe(`#${FIELD_ID}`);
    expect(doc.getElementById(FIELD_ID)).not.toBeNull();
  });

  it.skip('the summary is `role="alert"` and comes before the page content', async () => {
    const { doc } = await served("Amount");
    const summary = doc.querySelector(".k-summary");
    expect(summary?.getAttribute("role")).toBe("alert");
    const root = doc.getElementById("lb.root");
    expect(root).not.toBeNull();
    expect(((summary?.compareDocumentPosition(root ?? doc) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
  });

  it.skip("the link text is the label, never the path `amount`, for any label (property)", async () => {
    await fc.assert(
      fc.asyncProperty(label, async (text) => {
        const { status, doc } = await served(text);
        expect(status).toBe(422);
        const item = doc.querySelector(".k-summary li");
        expect(collapse(item?.textContent ?? "")).toBe(`${text}: ${messageOf(doc)}`);
        expect(collapse(item?.querySelector("a")?.textContent ?? "")).toBe(text);
        expect(collapse(item?.textContent ?? "")).not.toMatch(/^amount\b/);
      }),
      { seed: 1337, numRuns: 6 },
    );
  });
});
