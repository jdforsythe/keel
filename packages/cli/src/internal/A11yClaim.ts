/**
 * One `a11y:<project>:<routeId>#<criterion>` ledger item (k.a11y Claims): `example` or `none`, with its evidence line.
 * `project` is the project's directory relative to the run, `.` for the run's own.
 */
export type A11yClaim = {
  readonly item: string;
  readonly project: string;
  readonly route: string;
  readonly criterion: string;
  readonly rung: "none" | "example";
  readonly evidence: string;
};
