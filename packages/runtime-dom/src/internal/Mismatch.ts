/** Server HTML does not match the compiled structure (E1253). Internal: resume catches it. */
export class Mismatch extends Error {
  readonly code = "E1253";
}
