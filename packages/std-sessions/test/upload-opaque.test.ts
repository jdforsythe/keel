// @vitest-environment happy-dom
// @vitest-environment-options {"url": "about:blank"}
// An opaque page (`self.origin` is "null": a sandboxed frame, `file:`, `about:blank`) has no origin to upload to:
// every `upload` throws E2006, also one whose own origin is "null". Seed 1337
import { createCtx } from "@keel/ctx";
import { describe, expect, test } from "vitest";
import { record } from "../src/index.ts";

const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error && "code" in e ? e.code : e;
  }
  return undefined;
};

describe("opaque page", () => {
  test("the page's origin is opaque", () => {
    expect(location.origin).toBe("null");
  });

  test("an upload from an opaque page throws E2006, and record without upload still records", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    expect(codeOf(() => record(ctx, { upload: new URL("http://localhost:3000/sessions") }))).toBe("E2006");
    expect(codeOf(() => record(ctx, { upload: new URL("file:///sessions") }))).toBe("E2006");
    const rec = record(ctx);
    expect(rec.events()).toEqual([]);
    rec.stop();
  });
});
