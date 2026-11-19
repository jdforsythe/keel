import type { Signer } from "./Signer.ts";

/** True for the `x-keel-user` signer a `createApp` binds beside its modules (k.user Across deployables). */
export function isSigner(v: unknown): v is Signer {
  return typeof v === "function";
}
