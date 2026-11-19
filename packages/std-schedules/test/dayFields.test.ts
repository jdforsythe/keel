// std.schedules day fields: restricted unless the field starts with `*`. Seed 1337
import { expect, test } from "vitest";
import { parseCron } from "../src/internal/parseCron.ts";

test("a day field starting with `*` is unrestricted, any other is restricted", () => {
  expect(parseCron("0 0 */2 * *")).toMatchObject({ domR: false, dowR: false });
  expect(parseCron("0 0 * * */2")).toMatchObject({ domR: false, dowR: false });
  expect(parseCron("0 0 */2 * 1")).toMatchObject({ domR: false, dowR: true });
  expect(parseCron("0 0 1,15 * 1-5")).toMatchObject({ domR: true, dowR: true });
});
