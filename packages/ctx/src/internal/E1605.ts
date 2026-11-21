/** E1605 (k.persist): `drivers` on a `sim` ctx. */
export function E1605(): Error {
  return Object.assign(new Error("drivers on a sim ctx: simulation keeps the kernel's storage and net"), {
    code: "E1605",
  });
}
