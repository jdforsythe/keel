/**
 * A library's shipped tokens file read as text (k.looks Shipped tokens): the literal's value as far as it is in form,
 * its names per group (k.ui's order, `look` last; each in the order written), the offset of each group name's key
 * (`<group>\u0000<name>`), and the first node out of form as an E1812 message, or null.
 */
export type Shipped = {
  readonly value: Readonly<Record<string, unknown>>;
  readonly names: ReadonlyMap<string, readonly string[]>;
  readonly keys: ReadonlyMap<string, number>;
  readonly problem: { readonly at: number; readonly message: string } | null;
};
