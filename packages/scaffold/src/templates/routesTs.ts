/** `modules/<id>/routes.ts` (k.router): an empty manifest. */
export function routesTs(): string {
  return ["import { manifest } from '@keel/router'", "", "export const routes = manifest({})", ""].join("\n");
}
