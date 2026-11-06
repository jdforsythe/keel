/** One k.router manifest entry: path, `params` iff the path has `:name`, loader, page component. */
export function routeEntry(
  id: string,
  path: string,
  params: readonly string[],
  loaderName: string,
  page: string,
): string {
  const parts = [`path: '${path}'`];
  if (params.length > 0) parts.push(`params: s.object({ ${params.map((p) => p.concat(": s.string()")).join(", ")} })`);
  parts.push(`loader: ${loaderName}`, `component: ${page}`);
  return `'${id}': { ${parts.join(", ")} }`;
}
