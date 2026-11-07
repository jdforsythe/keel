/** Whether a project-relative path lies under a `node_modules/` folder: an installed package no fix may edit. */
export function inNodeModules(path: string): boolean {
  return /(?:^|\/)node_modules\//.test(path);
}
