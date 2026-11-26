// The `static` fixture of k.e2e's serve clause (not a test file): one `static` deployable `site` over module `s` with the route `/`
// (a text and an island button), after packages/cli/conformance/static-support.ts's `staticTree`. Seed 1337.
import { type Tree, manifest, rootFiles } from "./node-app.ts";

export const SITE_TEXT = "SITE-TEXT-1337";

export const staticApp = (): Tree => ({
  ...rootFiles("{ site: { modules: ['s'], adapter: 'static' } }"),
  "modules/s/module.ts": manifest("s"),
  "modules/s/s.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const s = contract('s', { 's.home': { path: '/' } })\n",
  "modules/s/home.server.ts": `import { loader } from '@keel/router'\nimport { ok, s as sc } from '@keel/schema'\nimport { s } from './s.contract.ts'\nexport const home = loader(s, 's.home', { output: sc.object({ text: sc.string() }) }, async () => ok({ text: '${SITE_TEXT}' }))\n`,
  "modules/s/Page.tsx":
    "import { Box, Button, Text } from '@keel/ui'\nexport default function Page(props: { data: { text: string } }) {\n  return (\n    <Box as=\"main\">\n      <Text id=\"s.page.text\">{props.data.text}</Text>\n      <Button id=\"s.page.more\" onClick={() => undefined}>More</Button>\n    </Box>\n  )\n}\n",
  "modules/s/routes.ts":
    "import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nimport { home } from './home.server.ts'\nimport { s } from './s.contract.ts'\nexport const routes = manifest(s, { 's.home': { component: Page, loader: home } })\n",
});
