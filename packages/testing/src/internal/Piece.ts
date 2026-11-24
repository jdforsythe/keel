/**
 * One piece of pending work of a run: its label (held work's own, else the resource's Node type) and, for a resource,
 * a weak reference to it, so a resource only a garbage collection would destroy is told from one still in use.
 */
export interface Piece {
  readonly label: string;
  readonly resource?: WeakRef<object>;
}
