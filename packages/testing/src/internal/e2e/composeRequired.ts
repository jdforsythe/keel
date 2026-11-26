/**
 * The variables `deploy/compose.yaml` (k.deploy, written by `keel build`) marks required per service: each
 * `NAME: ${NAME:?}` line under the service's `environment:`.
 */
export function composeRequired(yaml: string): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();
  let section = "";
  let service: string | undefined;
  let inEnv = false;
  for (const line of yaml.split("\n")) {
    if (/^\S/.test(line)) {
      section = line.replace(/:.*$/, "");
      service = undefined;
      continue;
    }
    if (section !== "services") continue;
    const svc = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (svc?.[1] !== undefined) {
      service = svc[1];
      inEnv = false;
      out.set(service, []);
      continue;
    }
    if (/^ {4}\S/.test(line)) inEnv = /^ {4}environment:/.test(line);
    const v = /^ {6}([A-Z0-9_]+):\s*\$\{\1:\?\}/.exec(line);
    if (service !== undefined && inEnv && v?.[1] !== undefined) out.get(service)?.push(v[1]);
  }
  return out;
}
