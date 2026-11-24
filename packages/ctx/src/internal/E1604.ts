/** E1604 (k.sim): a schedule or `replica` outside sim, one that fails `Schedule`, or a plan step that fails its capability's schema. */
export function E1604(message: string): Error {
  return Object.assign(new Error(message), { code: "E1604" });
}
