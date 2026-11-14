/** Thrown inside the translation: a construct outside the fragment, or a schema without a sort (E1715). */
export class Outside extends Error {
  constructor(
    readonly construct: string,
    readonly at: number | undefined,
  ) {
    super(construct);
  }
}
