/**
 * The check a write to module state asks first (k.shared): `signal.set` on a node a module root owns (kind `signal`),
 * and `run` on a module root or a scope it owns (kind `root`), before anything changes. `node` is the node's
 * `inspect` id. `@keel/server` installs one that raises the E1256 defect while it serves a request; in a browser none
 * is installed and every write passes.
 */
export const moduleWrites: { check: ((node: number, kind: "signal" | "root") => void) | null } = { check: null };
