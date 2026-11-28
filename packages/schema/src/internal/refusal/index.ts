// `@keel/schema/internal/refusal`: the coded-refusal guard alone, for the production entry, which reads it before
// any module that enters the census (k.deploy Refusals at start). re-exports only.
export { isRefusal } from "../isRefusal.ts";
