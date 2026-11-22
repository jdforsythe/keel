/** One path a range changes (`git diff --name-status -M`): `from` is the path at `<base>`, absent for an added file. */
export type Change = {
  readonly status: "A" | "M" | "D" | "R";
  readonly path: string;
  readonly from?: string;
  /** A rename with no change to the file's bytes. */
  readonly same?: boolean;
};
