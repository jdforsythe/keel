// `@keel/create-app`'s build: `src/bin.ts` and everything it imports, `@keel/scaffold/create` of this same version
// among it, bundled into one file, `dist/bin.js`, so the published package has no dependency at all (k.create Package).
// Only Node's own modules stay imports.
import { build } from "esbuild";

await build({
  entryPoints: [new URL("src/bin.ts", import.meta.url).pathname],
  outfile: new URL("dist/bin.js", import.meta.url).pathname,
  bundle: true,
  minify: true,
  format: "esm",
  platform: "node",
  target: "node22",
  logLevel: "warning",
  plugins: [
    {
      name: "node-only",
      setup(b) {
        // Anything but Node's own modules and `@keel/*` sources is a dependency the package must not have.
        b.onResolve({ filter: /^[^./]/ }, (a) => {
          if (a.path.startsWith("node:")) return { path: a.path, external: true };
          if (a.path.startsWith("@keel/")) return undefined;
          return { errors: [{ text: `create-app bundles no third-party package: ${a.path}` }] };
        });
      },
    },
  ],
});
