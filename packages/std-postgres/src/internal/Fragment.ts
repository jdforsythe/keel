/**
 * A piece of statement text made by `fragment` (std.postgres): `sql` splices its text and numbers its parameters in
 * place. Only a value made by `fragment` is spliced; every other value is a parameter.
 */
export class Fragment {
  readonly strings: readonly string[];
  readonly values: readonly unknown[];

  constructor(strings: readonly string[], values: readonly unknown[]) {
    this.strings = Object.freeze([...strings]);
    this.values = Object.freeze([...values]);
    Object.freeze(this);
  }
}
