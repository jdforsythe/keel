import { packageJson } from "../templates/packageJson.ts";

/** The packages an app's `package.json` lists, which its own name may not be (k.create Names). */
export const LISTED: ReadonlySet<string> = (() => {
  const pkg: unknown = JSON.parse(packageJson("x"));
  const keys = (k: string): string[] => {
    const v: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, k) : undefined;
    return typeof v === "object" && v !== null ? Object.keys(v) : [];
  };
  return new Set([...keys("dependencies"), ...keys("devDependencies")]);
})();
