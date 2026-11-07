// Spec: k.compiler Rules E1049 (internal compiler failure: message verbatim, no app location or code). A failure is
// injected through the public API (a source that throws when read); rfc:0065, backlog 0186. No random inputs.
import { compile } from "@keel/compiler";
import { expect, test } from "vitest";

test("a failure inside compile is E1049 with the message verbatim and no app location", () => {
  const files = [
    {
      path: "a.ts",
      get source(): string {
        throw new Error("injected read failure");
      },
    },
  ];
  let thrown: unknown = null;
  try {
    compile(files);
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect(thrown).toMatchObject({ code: "E1049", message: "internal compiler failure: injected read failure" });
  expect(thrown !== null && typeof thrown === "object" && ("path" in thrown || "line" in thrown)).toBe(false);
});
