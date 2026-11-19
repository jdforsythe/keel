const RE = /^((?:.*\/)?)modules\/([^/]+)\/(.+)$/;

/** Splits `<prefix>modules/<id>/<rest>`; `prefix` is "" or ends with `/`. */
export function moduleFile(path: string): { prefix: string; id: string; rest: string } | undefined {
  const m = RE.exec(path);
  if (m === null) return undefined;
  return { prefix: m[1] ?? "", id: m[2] ?? "", rest: m[3] ?? "" };
}
