/**
 * `modules/app/HomePage.tsx` of a new project (k.create Files): the heading `app.home.title`, the project's name, and
 * the paragraph `app.home.next`, which names the file to edit and `keel docs` in the project's form `run`. `name` is a project name
 * (`[a-z][a-z0-9-]*`), so it is JSX text as it is.
 */
export function homePageTsx(name: string, run = "pnpm keel"): string {
  return [
    `import { type Infer, s } from "@keel/schema";`,
    `import { Box, Heading, Text } from "@keel/ui";`,
    "",
    "export const Props = s.object({});",
    "",
    "export default function HomePage(_props: Infer<typeof Props>) {",
    "  return (",
    `    <Box id="app.home" as="main" direction="column" gap="3" p="4">`,
    `      <Heading id="app.home.title" level={1}>`,
    `        ${name}`,
    "      </Heading>",
    `      <Text id="app.home.next" as="p" m="0">`,
    `        Edit modules/app/HomePage.tsx to change this page. Run ${run} docs to read how Keel works.`,
    "      </Text>",
    "    </Box>",
    "  );",
    "}",
    "",
  ].join("\n");
}
