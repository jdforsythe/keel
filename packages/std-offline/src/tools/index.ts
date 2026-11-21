// re-exports only. `@keel/std-offline/tools` is the node-only half `importDeps` loads for `keel check` and
// `keel build`: rule E2651, registered at import.
export { secretOutboxBody } from "./secretOutboxBody.ts";
