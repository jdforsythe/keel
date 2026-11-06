/** Raw HTML sinks (E1002): never emitted, in JSX attributes or member access. */
export const RAW_HTML: ReadonlySet<string> = new Set([
  "innerHTML",
  "outerHTML",
  "insertAdjacentHTML",
  "dangerouslySetInnerHTML",
]);
