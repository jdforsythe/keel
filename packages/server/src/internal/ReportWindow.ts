/**
 * The CSP report window (k.security Reports): `open` while a 60 s window of `ctx.clock` runs, `logged` the reports it
 * logged (at most 100), `dropped` those it counted past that.
 */
export type ReportWindow = { open: boolean; logged: number; dropped: number };
