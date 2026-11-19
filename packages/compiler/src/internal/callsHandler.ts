const IMPORT = /import\s*\{([^}]*)\}\s*from\s*["']@keel\/router["']/g;
const CTORS: ReadonlySet<string> = new Set(["loader", "action", "guard"]);

/** Whether `code` calls `loader`, `action` or `guard` imported by name from `@keel/router` (k.boundary Assertion). */
export function callsHandler(code: string): boolean {
  if (!code.includes("@keel/router")) return false;
  const locals: string[] = [];
  for (const m of code.matchAll(IMPORT))
    for (const part of (m[1] ?? "").split(",")) {
      const [name = "", local = name] = part.trim().split(/\s+as\s+/);
      if (CTORS.has(name)) locals.push(local.trim());
    }
  return locals.some((l) => new RegExp(`(?<![\\w$.])${l.replace(/\$/g, "\\$")}\\s*\\(`).test(code));
}
