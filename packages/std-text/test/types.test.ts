// Seed 1337 (no random inputs)
import type { Format, s } from "@keel/schema";
import { expectTypeOf, test } from "vitest";
import { type Email, type Slug, line, type para } from "../src/index.ts";

test("line and para brand their bounds into the type; a value of one bound is not assignable to another", () => {
  type L80 = s.infer<ReturnType<typeof line<80>>>;
  const l03 = line({ min: 0, max: 3 });
  expectTypeOf<L80>().toEqualTypeOf<Format<string, "line(1..80)">>();
  expectTypeOf<s.infer<typeof l03>>().toEqualTypeOf<Format<string, "line(0..3)">>();
  expectTypeOf<s.infer<ReturnType<typeof para<2000>>>>().toEqualTypeOf<Format<string, "para(1..2000)">>();
  expectTypeOf<L80>().not.toExtend<s.infer<typeof l03>>();
  expectTypeOf<L80>().toExtend<string>();
  expectTypeOf<string>().not.toExtend<L80>();
  expectTypeOf<s.infer<typeof Email>>().toEqualTypeOf<Format<string, "text.Email">>();
  expectTypeOf<s.infer<typeof Slug>>().not.toExtend<s.infer<typeof Email>>();
});
