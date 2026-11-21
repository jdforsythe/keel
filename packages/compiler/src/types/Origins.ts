/**
 * A deployable's declared third-party origins (k.origins Declaration): per directive, each exact origin mapped to its
 * reason, in declaration order. Only these widen the content security policy Keel emits for the deployable.
 */
export type Origins = {
  readonly img?: Readonly<Record<string, string>>;
  readonly media?: Readonly<Record<string, string>>;
  readonly font?: Readonly<Record<string, string>>;
  readonly connect?: Readonly<Record<string, string>>;
  readonly frame?: Readonly<Record<string, string>>;
};
