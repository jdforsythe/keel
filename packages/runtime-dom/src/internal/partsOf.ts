/**
 * The nodes multi-item content stands for while resuming (`frag`): its items' server nodes in document order, already
 * in place; an op among them stands for its region's markers and its anchor.
 */
export const partsOf = new WeakMap<Node, readonly Node[]>();
