/**
 * One structural finding on a chart: its rule code, where (`at`), one line of message, and `fix`, the replacement a
 * fix writes there (E2751: the nearest state name; E2753: `{ final: true }`).
 */
export type Problem<P> = {
  readonly code: "E2751" | "E2753" | "E2754";
  readonly at: P;
  readonly message: string;
  readonly fix?: string;
};
