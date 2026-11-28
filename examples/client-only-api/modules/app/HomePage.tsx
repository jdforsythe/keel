import { type Infer, s } from "@keel/schema";
import { Box, Heading, Link, Text } from "@keel/ui";
import Masthead from "./Masthead.tsx";
import { app } from "./app.contract.ts";

export const Props = s.object({});

export default function HomePage(_props: Infer<typeof Props>) {
  return (
    <Box id="app.home" direction="column" gap="2">
      <Masthead />
      <Box as="main" direction="column" gap="3" p="4">
        <Heading id="app.home.title" level={1}>
          A site with no server
        </Heading>
        <Text id="app.home.lead" as="p" m="0">
          These pages are files on a static host. No Keel server sent them, and none answers them.
        </Text>
        <Text as="p" m="0">
          The releases page reads a public API of another organisation from your browser.
        </Text>
        <Link id="app.home.toReleases" to={app.href("app.releases")}>
          See the latest Node.js releases
        </Link>
      </Box>
    </Box>
  );
}
