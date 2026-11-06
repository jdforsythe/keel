/** A compiled island component, called with its decoded props. (Bivariant so typed props are accepted.) */
export type Island = { bivariance(props: Readonly<Record<string, unknown>>): Node }["bivariance"];
