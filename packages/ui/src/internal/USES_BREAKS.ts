/**
 * Whether the app writes a break prop (`breakBefore`, `breakAfter`, `breakInside`). True here, so a run from source (tests, `keel dev`) has every prop; a
 * `vite build` with the Keel plugin serves this module as `false` when no source of the app writes one (k.compiler
 * Build), and the bundler then drops the run-time code it guards, so an app that never writes one carries no bytes for it.
 */
export const USES_BREAKS: boolean = true;
