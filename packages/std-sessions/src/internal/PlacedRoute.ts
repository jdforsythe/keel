/**
 * A placed module's route table: its id, and where it is imported from (`app`: its `modules/<id>/routes.ts`); `contract`
 * is a stdlib module's `./contract` specifier (`''` for an app module, whose contract file is `<id>.contract.ts`).
 */
export type PlacedRoute = {
  readonly module: string;
  readonly app: boolean;
  readonly spec: string;
  readonly contract: string;
};
