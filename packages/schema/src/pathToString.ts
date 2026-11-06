/** Format an issue path as dotted text: `['users', 0, 'name']` gives `users.0.name`. */
export function pathToString(path: readonly (string | number)[]): string {
  return path.join(".");
}
