import { type Infer, s } from "@keel/schema";
import { Box, Image, Link, Text } from "@keel/ui";
import { app } from "./app.contract.ts";

export const Props = s.object({});

/** The brand masthead (docs/BRAND.md): the keel mark, the app's name and a link to each page. */
export default function Masthead(_props: Infer<typeof Props>) {
  return (
    <Box as="header" direction="row" align="center" gap="3" px="4" py="4">
      <Image src="/keel-mark.svg" decorative h="mark" />
      <Text font="mono" fontSize="sm">
        client-only-api
      </Text>
      <Box as="nav" label="Pages" direction="row" gap="3">
        <Link id="app.nav.home" to={app.href("app.home")}>
          Home
        </Link>
        <Link id="app.nav.releases" to={app.href("app.releases")}>
          Releases
        </Link>
      </Box>
    </Box>
  );
}
