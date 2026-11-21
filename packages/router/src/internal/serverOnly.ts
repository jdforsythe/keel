import { STUB } from "./STUB.ts";
import { codedError } from "./codedError.ts";

/**
 * The stub a browser build gives for export `name` of the server-only `file` (k.boundary): a function that throws an
 * Error with code E1008 when called. `manifest` and `routes.actions` accept it where a loader, action or guard goes.
 */
export function serverOnly(file: string, name: string): () => never {
  const stub = (): never => {
    throw codedError("E1008", `${name} of ${file} runs only on the server`);
  };
  return Object.assign(stub, { [STUB]: true });
}
