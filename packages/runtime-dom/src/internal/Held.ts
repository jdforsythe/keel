/**
 * The server's content of a resumed island's child level (k.resume Layout islands): `nodes` is null until the
 * claim reaches the slot that holds it; `calls` counts `children` calls while the island builds, -1 otherwise.
 */
export interface Held {
  nodes: Node[] | null;
  calls: number;
}
