/** What the compiler emits around a bound k.ui base element with a literal `id` in a `.tsx` module: its `data-k` stamp. */
export const stamped = (n: Node, id: string): Node => {
  if (n instanceof Element && n.hasAttribute("data-k")) n.setAttribute("data-k", id);
  return n;
};
