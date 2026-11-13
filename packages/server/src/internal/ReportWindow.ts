/**
 * The CSP report window (k.security Reports): `open` while a 60 s window of `ctx.clock` runs, `logged` the reports it
 * logged (at most 100), `dropped` those it counted past a cap, and `sources` the reports it logged per source (at most
 * 10 each), held in memory for the window only and never logged.
 */
export type ReportWindow = { open: boolean; logged: number; dropped: number; readonly sources: Map<string, number> };
