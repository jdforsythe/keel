/**
 * The problem of deployable name `name`, or undefined when it has the one form (k.topology): lowercase letters,
 * digits and `-`, starting with a letter. A name becomes `dist/<name>/`, `.keel-dev/<name>.storage.json` and
 * `KEEL_PEER_<NAME>`, so in this form no name leaves its folder and no two names meet on a case-insensitive disk or
 * upper-cased.
 */
export function deployableNameProblem(name: string): string | undefined {
  return /^[a-z][a-z0-9-]*$/.test(name)
    ? undefined
    : `${name}: name must be lowercase letters, digits and -, starting with a letter`;
}
