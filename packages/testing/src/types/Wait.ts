/**
 * A wait's bound (k.e2e Time): `within` ms the test chose, multiplied by `KEEL_TEST_TIME_SCALE`, plus `fixed` ms of the
 * app's own time (a lease, a workflow step), added unscaled. With neither, the bound is 10 s, scaled.
 */
export type Wait = { readonly within?: number; readonly fixed?: number };
