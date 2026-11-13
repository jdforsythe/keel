/** A chart's store value (std.statecharts): the current state's name and the chart's `data`. */
export type ChartState<S extends string, D> = { state: S; data: D };
