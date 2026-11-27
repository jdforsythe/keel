/**
 * The Node built-ins whose every call a build-time evaluation records with its arguments as a probe (k.derived
 * Derivation cache): each answers from the machine and its environment (`os.homedir()`, `tty.isatty(1)`), so the
 * answer, asked again, decides whether a cached derivation holds.
 */
export const RECORDED_BUILTINS: readonly string[] = ["os", "tty"];
