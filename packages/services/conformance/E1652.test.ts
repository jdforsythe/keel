import { describe, it } from "vitest";
describe("k.services: E1652", () => {
  // UNTESTABLE at runtime: checker rule on source; the spec gives no runtime throw/diagnostic for declarations (cf. k.schema: "never runtime codes").
  it.todo("E1652 a `:param` in `path` without a field in `params`, or a `params` field missing from `path`");
});
