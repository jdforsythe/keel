/** A deployable of a project's `topology.ts`, as `serve` starts or hosts it (k.e2e serve). */
export type Deployable = {
  readonly name: string;
  readonly adapter: "node" | "static" | "client";
  readonly servedBy?: string;
  readonly modules: readonly string[];
  readonly storage: "file" | "sqlite" | "postgres";
  /** The variables `deploy/compose.yaml` marks required for it (k.deploy): its served modules' `env` among them. */
  readonly required: readonly string[];
};
