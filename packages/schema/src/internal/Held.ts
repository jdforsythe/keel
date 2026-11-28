/** A maker's record of what it made (k.identity): read by `has`, written by `add`, held in a binding of its package. */
export type Held = {
  readonly has: (x: unknown) => boolean;
  readonly add: (x: object) => void;
};
