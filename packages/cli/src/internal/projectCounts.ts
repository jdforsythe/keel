const PKG_CODE = /^packages\/[^/]+\/(?:src|unsafe)\//;
const APP = /^apps\/[^/]+\//;
/** An app's own modules when `keel ledger` runs in the app's folder. */
const ROOT_APP = /^modules\//;

/**
 * Which of the ledger file's top-level counts read the project file at `rel` (k.ledger File, k.host-element Ledger):
 * `unsafe` and `hostElements` both for `packages/<pkg>/{src,unsafe}/**` and a root `modules/**`, `hostElements` alone
 * for `apps/<app>/**` (an app's `unsafe` is its own, under `--scope`). A path under a `node_modules` folder is a
 * library's (k.library Ledger), read by neither.
 */
export function projectCounts(rel: string): { unsafe: boolean; hostElements: boolean } {
  if (/(?:^|\/)node_modules\//.test(rel)) return { unsafe: false, hostElements: false };
  const both = PKG_CODE.test(rel) || ROOT_APP.test(rel);
  return { unsafe: both, hostElements: both || APP.test(rel) };
}
