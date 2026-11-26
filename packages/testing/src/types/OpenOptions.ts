/** `Served.open` options (k.e2e-page open). */
export type OpenOptions = {
  readonly deployable?: string;
  /** `false` opens a context with scripts off. */
  readonly scripts?: boolean;
  /** `true` shows the document with no script of the app run until `resume()`. */
  readonly hold?: boolean;
};
