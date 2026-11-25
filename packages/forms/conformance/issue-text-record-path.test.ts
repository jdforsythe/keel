// @vitest-environment happy-dom
// Spec: k.forms, Validation "Its `path` is the key `errors()` uses: the issue's path segments joined by `.`, a record key and an array index as the input holds them, so a record key a person typed reaches `issueText`, and one holding `.` reads as more segments."
// Spec: k.forms, Conformance "With `form(s.object({ tags: s.record(s.string({ max: 3 })) }), { issueText })`, for every record key `k` that `parse` accepts, a submit of `{ tags: { [k]: 'long' } }` calls `issueText` with an issue whose `rule` is `max`, `max` 3 and `path` `tags.` followed by `k`, and `errors()` holds that path; without `issueText` its message is one text for every such `k` and every value longer than 3 characters, so it holds neither the key nor the value."
// Seed 1337 (fc.assert below). Fixture: a `Form` over a memory-history router as fixtures.ts builds one, the record's value given as `initial` (the clause's "a submit of { tags: { [k]: 'long' } }"), no bound input.
// ASSUMPTIONS: `initial` carries the submitted values (no input is bound, so a submit sends the form's values()); `issue.path` is the string joined by `.`; the English-text half is asserted by plain equality of the message across keys and values.
import { createCtx } from "@keel/ctx";
import { form } from "@keel/forms";
import { Form, action, createRouter, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, memoryHistory, settle } from "./fixtures.ts";

const Tags = s.object({ tags: s.record(s.string({ max: 3 })) });
type Seen = { rule: string; path: unknown; max?: number };

async function submitWith(
  k: string,
  value: string,
  issueText?: (issue: Seen) => string,
): Promise<{ seen: Seen[]; errors: Record<string, string> }> {
  const seen: Seen[] = [];
  const c = contract("tg", { "tg.edit": { path: "/tags" } });
  const save = action(c, "tg.edit", { input: Tags }, async () => ok(null));
  const holder: { errors?: () => Record<string, string> } = {};
  const Page = (): HTMLFormElement => {
    const f = form(Tags, {
      initial: { tags: { [k]: value } },
      ...(issueText === undefined
        ? {}
        : {
            issueText: (issue: Seen) => {
              seen.push({ ...issue });
              return issueText(issue);
            },
          }),
    });
    holder.errors = () => ({ ...f.errors() });
    const button = document.createElement("button");
    button.type = "submit";
    return Form({ method: "POST", action: c.href("tg.edit"), form: f, children: () => [button] });
  };
  const routes = manifest(c, { "tg.edit": { component: Page, POST: save } });
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const router = createRouter(routes, { ctx, history: memoryHistory("/tags") });
  const root = document.createElement("div");
  document.body.appendChild(root);
  const dispose = mount(router.App, root, { ctx });
  try {
    const fe = root.querySelector("form");
    if (fe === null) throw new Error("fixture: no form element");
    fe.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    return { seen, errors: holder.errors?.() ?? {} };
  } finally {
    dispose();
    router.dispose();
    root.remove();
  }
}

const accepted = (k: string): boolean => Tags.parse({ tags: { [k]: "ok" } }).ok;
const keys = fc.oneof(
  fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/),
  fc.string({ minLength: 1, maxLength: 8 }),
  fc.constantFrom("a.b", "x.0", ".", "a b", "Ünï", "0", "tags", "__proto", "constructors"),
);

describe("k.forms: issueText's path holds record keys as the input gave them", () => {
  test("with form(s.object({ tags: s.record(s.string({ max: 3 })) }), { issueText }), a submit of { tags: { k: 'long' } } calls issueText with rule max, max 3 and path tags.k, and errors() holds that path", async () => {
    const { seen, errors } = await submitWith("k", "long", () => "T");
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ rule: "max", max: 3, path: "tags.k" });
    expect(Object.keys(errors)).toContain("tags.k");
  });

  test("for every record key k that parse accepts, a submit of { tags: { [k]: 'long' } } calls issueText with an issue whose rule is max, max 3 and path tags. followed by k, and errors() holds that path", async () => {
    await fc.assert(
      fc.asyncProperty(keys.filter(accepted), async (k) => {
        const { seen, errors } = await submitWith(k, "long", () => "T");
        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatchObject({ rule: "max", max: 3, path: `tags.${k}` });
        expect(Object.keys(errors)).toContain(`tags.${k}`);
        expect(errors[`tags.${k}`]).toBe("T");
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("without issueText its message is one text for every such k and every value longer than 3 characters, so it holds neither the key nor the value", async () => {
    const base = await submitWith("zz", "long");
    const baseMessage = base.errors["tags.zz"];
    expect(typeof baseMessage).toBe("string");
    await fc.assert(
      fc.asyncProperty(keys.filter(accepted), fc.string({ minLength: 4, maxLength: 12 }), async (k, value) => {
        const { errors } = await submitWith(k, value);
        expect(Object.keys(errors)).toContain(`tags.${k}`);
        expect(errors[`tags.${k}`]).toBe(baseMessage);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});
