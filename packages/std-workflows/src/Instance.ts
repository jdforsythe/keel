/**
 * One workflow instance (std.workflows): its chart state's name and `data`, `entered`, raised by one each time the
 * state's name changes, and `attempt`, the runs of the current step, 0 on entering a state.
 */
export type Instance<S extends string, D> = { state: S; data: D; entered: number; attempt: number };
