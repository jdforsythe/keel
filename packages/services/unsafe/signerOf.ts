import type { Signer } from "../src/internal/Signer.ts";
import { unsafe } from "./unsafe.ts";

/** The `keel.user` entry of the `MODULES_KEY` table as the `x-keel-user` signer when it is a function. */
export function signerOf(v: unknown): Signer | undefined {
  if (typeof v !== "function") return undefined;
  return unsafe(
    "server bindModules sets the table's keel.user entry to the deployable's x-keel-user signer, the one function the table holds, so it has the Signer signature",
    () => v as Signer,
  );
}
