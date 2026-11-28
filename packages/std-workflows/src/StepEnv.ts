/** What a step's `run` gets beside `data` and `ctx` (std.workflows): `signal`, aborted on timeout or stop, and `key`, `<id>:<flow>:<entered>`, the same on every run of one entry. */
export type StepEnv = { readonly signal: AbortSignal; readonly key: string };
