// Child process for evaluate-require.test.ts (not a test file): evaluates `modules/m/routes.ts` of the app folder argv[2]
// in plain Node, where a bundle has no `require` of its own, and prints `{ problems, routes }` (the route ids).
import { evaluateProject } from "../src/internal/evaluateProject.ts";

const root = process.argv[2] ?? "";
const r = await evaluateProject({ root, tokensFile: undefined, routesFiles: ["modules/m/routes.ts"], usages: [] });
process.stdout.write(`${JSON.stringify({ problems: r.problems, routes: Object.keys(r.routes) })}\n`);
