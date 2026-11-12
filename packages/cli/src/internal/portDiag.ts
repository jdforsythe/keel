import type { Diag } from "./Diag.ts";
import { makeDiag } from "./makeDiag.ts";

/** The one E1560 line of `keel dev` when its port will not bind: names the port, never another one. */
export function portDiag(port: number): Diag {
  return makeDiag("E1560", `dev port ${port} is in use`, {
    fix: "stop the other listener or pass --port <free port>",
    see: "k.cli",
  });
}
