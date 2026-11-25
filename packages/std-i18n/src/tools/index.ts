// re-exports only (one export per file lives in src/<Export>.ts); the import registers `i18n.Locale` for `keel check` and `keel build`, which load a library through `./tools`
import "../Locale.schema.ts";

export { localeFormatter } from "./localeFormatter.ts";
