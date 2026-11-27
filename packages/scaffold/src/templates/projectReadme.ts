import type { Manager } from "../internal/Manager.ts";

/**
 * `README.md` of a new project (k.create Files): what it is, the commands in the manager's form, where to edit first,
 * how to add a page, how this kind deploys (a `node` one's environment values), and how to move every `@keel/*`
 * package to a new version together.
 */
export function projectReadme(name: string, adapter: "client" | "node" | "static", m: Manager): string {
  const k = m.run;
  const deploy =
    adapter === "node"
      ? [
          `\`${k} build\` writes \`dist/web/server.mjs\`, \`deploy/web/Dockerfile\` and \`deploy/compose.yaml\`. Run the server with \`node dist/web/server.mjs\` and these environment values:`,
          "",
          "- `PORT`: the port it listens on.",
          "- `KEEL_SECRET`: at least 32 random bytes; it signs what the server hands out. Keep it out of the repository.",
          "- `KEEL_ORIGIN`: the public origin people reach it at, such as `https://shop.example.com`.",
          "",
          "Or build the image: `docker build -f deploy/web/Dockerfile .`.",
        ]
      : [
          `\`${k} build\` writes \`dist/web/\`, files with no server${adapter === "static" ? ", each route prerendered" : ""}. Upload that folder to a static host and send \`dist/web/csp.txt\` as the \`Content-Security-Policy\` header.`,
        ];
  return [
    `# ${name}`,
    "",
    `A Keel ${adapter === "node" ? "app with a server" : adapter === "static" ? "site of prerendered pages" : "app that runs in the browser"}.`,
    "",
    "## Commands",
    "",
    "Run Keel through the project, never from a global `keel`.",
    "",
    `- \`${m.install}\` once, then \`${k} dev\`: the app at http://localhost:5173 (\`--port <n>\` for another port).`,
    `- \`${k} check\`, \`${k} test\`, \`${k} build\`.`,
    `- \`${k} docs\` lists Keel's docs; \`${k} explain <code>\` explains a diagnostic.`,
    "",
    "## Where to start",
    "",
    "`modules/app/HomePage.tsx` is the page at `/`; its test is `modules/app/home.route.test.ts`. Add a page with",
    `\`${k} scaffold route app.about --path /about\`.`,
    "",
    "## Deploy",
    "",
    ...deploy,
    "",
    "## Upgrade",
    "",
    "Every `@keel/*` package is pinned to one version. To move them together: set each `@keel/*` entry of",
    `\`package.json\` to the new version, run \`${m.install}\`, then \`${k} docs --sync\` (it rewrites \`AGENTS.md\`'s block`,
    `and the skill copies; \`${k} check\` reports W1356 until it runs), then \`${k} check\` and \`${k} test\`.`,
    "",
  ].join("\n");
}
