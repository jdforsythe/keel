/** A module manifest as declared in `modules/<id>/module.ts` (k.module). */
export type ModuleDef = {
  readonly id: string;
  readonly deps: readonly string[];
  readonly capabilities: readonly string[];
  readonly public: { readonly exports: readonly string[]; readonly routes: readonly string[] };
};
