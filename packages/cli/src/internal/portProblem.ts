/** The phrase after the port in the E1560 line of `keel dev`: a port the user may not bind is not "in use". */
export function portProblem(code: string | undefined): string {
  return code === "EACCES" ? "cannot be bound" : "is in use";
}
