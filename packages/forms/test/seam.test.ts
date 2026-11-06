import { s } from "@keel/schema";
import { expectTypeOf, it } from "vitest";
import type { form } from "../src/index.ts";
import type { FormHandle } from "../src/internal/FormHandle.ts";

const Note = s.object({ title: s.string({ min: 1 }), age: s.int(), a: s.object({ b: s.array(s.string()) }) });

it("the handle form() returns is structurally the router's FormHandle", () => {
  expectTypeOf<ReturnType<typeof form<typeof Note>>>().toMatchTypeOf<FormHandle>();
});
