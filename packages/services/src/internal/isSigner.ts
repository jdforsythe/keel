/** True for the `x-keel-user` signer a `createApp` binds beside its modules (k.user Across deployables). */
export function isSigner(v: unknown): v is (method: string, url: string, user: string) => string {
  return typeof v === "function";
}
