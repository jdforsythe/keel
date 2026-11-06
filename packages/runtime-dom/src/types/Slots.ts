/** Named slots passed to a component (k.component): each renders its content on call. The default slot is `props.children` (RFC 0008). */
export type Slots = Readonly<Record<string, () => Node>>;
