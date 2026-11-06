/** A capability's three implementations. Each factory runs once per ctx; `seed` is the ctx seed. */
export interface Capability<T extends object> {
  readonly real: (opts: { readonly seed: number }) => T;
  readonly shell: (opts: { readonly seed: number }) => T;
  readonly sim: (opts: { readonly seed: number }) => T;
}
