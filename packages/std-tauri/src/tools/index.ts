// `@keel/std-tauri/tools`: the CLI-time half that `keel check` and `keel build` load for a project declaring `tauri`.
// Importing it registers the Tauri shell target (`../tools.ts`); it re-exports the two helpers other tools build on.
import "../tools.ts";

export { crateName } from "./crateName.ts";
export { tauriHttpCapability } from "./tauriHttpCapability.ts";
