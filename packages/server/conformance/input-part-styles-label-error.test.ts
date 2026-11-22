// @vitest-environment happy-dom
// Spec: k.ui, Conformance "`styles={{ label: { fg: 'accent' }, error: { fg: 'error' } }}` on an `Input` with a `field` puts those classes on its `<label>` and its error element."
// Spec: k.ui, Base: "Base elements carry their role class whatever the tokens (`k-heading`, `k-link`, `k-button`, `k-control`, `k-label`, `k-error`)."
// Seed: 1337 (no random inputs; the label text varies in no-script-summary-label.test.ts).
// Not built yet: every case is `test.skip`; the builder changes `test.skip` to `test` in each.
// Asserted on the served 422 document, where the error element exists: the `<label for>` of the control and the element its `aria-describedby` names.
import { describe, expect, it } from "vitest";
import { FIELD_ID, appFor, postEmpty } from "./label-summary-routes.ts";

async function served(): Promise<Document> {
  const app = await appFor("Amount");
  const res = await app.fetch(postEmpty());
  return new DOMParser().parseFromString(await res.text(), "text/html");
}
const errorOf = (doc: Document): Element | null =>
  doc.getElementById(doc.getElementById(FIELD_ID)?.getAttribute("aria-describedby") ?? "");

describe("k.ui: part styles on an Input with a field", () => {
  it("`styles={{ label: { fg: 'accent' }, error: { fg: 'error' } }}` puts those classes on its `<label>` and its error element", async () => {
    const doc = await served();
    const label = doc.querySelector(`label[for="${FIELD_ID}"]`);
    expect(label).not.toBeNull();
    expect(label?.classList.contains("k-fg-accent")).toBe(true);
    expect(label?.classList.contains("k-fg-error")).toBe(false);
    const error = errorOf(doc);
    expect(error).not.toBeNull();
    expect(error?.classList.contains("k-fg-error")).toBe(true);
    expect(error?.classList.contains("k-fg-accent")).toBe(false);
  });

  it("the label and the error element carry their role classes `k-label` and `k-error`, and the control `k-control`", async () => {
    const doc = await served();
    expect(doc.querySelector(`label[for="${FIELD_ID}"]`)?.classList.contains("k-label")).toBe(true);
    expect(errorOf(doc)?.classList.contains("k-error")).toBe(true);
    expect(doc.getElementById(FIELD_ID)?.classList.contains("k-control")).toBe(true);
  });

  it("no element of the document has a `style` attribute", async () => {
    const doc = await served();
    expect(doc.querySelectorAll("[style]")).toHaveLength(0);
  });
});
