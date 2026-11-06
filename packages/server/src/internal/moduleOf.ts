/** The module id of a route id: its first dotted segment (k.module: ids are prefixed by their module). */
export function moduleOf(routeId: string): string {
  return routeId.split(".")[0] ?? routeId;
}
