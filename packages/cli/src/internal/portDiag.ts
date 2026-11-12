import type { Diag } from "./Diag.ts";
import { makeDiag } from "./makeDiag.ts";
import { portProblem } from "./portProblem.ts";

/** The one E1560 line of `keel dev` when its port will not bind: names the port, never another one. */
export function portDiag(port: number, code?: string): Diag {
  return makeDiag("E1560", `dev port ${port} ${portProblem(code)}`, {
    fix: "stop the other listener or pass --port <free port>",
    see: "k.cli",
  });
}
