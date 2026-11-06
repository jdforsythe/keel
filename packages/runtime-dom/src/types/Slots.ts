/** Named slots passed to a component (k.component): each renders its content on call. */
export type Slots = Readonly<Record<string, () => Node>>;
