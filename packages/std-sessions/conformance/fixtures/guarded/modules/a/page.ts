/** A page holding one paragraph of the given id. */
export const page = (id: string) => (): Node => {
  const p = document.createElement("p");
  p.id = id;
  p.textContent = id;
  return p;
};
