/** The key of a chart's own compiler: `chart[compileKey](id)` compiles the declaration again as the store `id`. */
export const compileKey: unique symbol = Symbol();
