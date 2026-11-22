import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Image, Text } from "@keel/ui";
import { ShellData } from "./ShellData.schema.ts";

export const Props = s.object({ data: ShellData });

/**
 * What every frame of the app renders: a masthead with the mark, the app's name and the household's name, the
 * navigation the frame passes in `nav`, a hairline, and the page in a centred column that narrows to the screen on a
 * phone. `app.frame` passes the member's navigation; `members.frame`, around the signed-out pages, the sign-in and
 * sign-up links.
 */
export default function Masthead(
  props: Infer<typeof Props> & { readonly nav: () => Node; readonly children: () => Node },
) {
  return (
    <Box id="frame" direction="column" bg="surface" fg="text" font="serif" fontSize="md">
      <Box
        as="header"
        id="frame.masthead"
        direction={{ base: "column", md: "row" }}
        align={{ base: "start", md: "center" }}
        justify="between"
        gap="3"
        px={{ base: "3", md: "6" }}
        py={{ base: "3", md: "4" }}
      >
        <Box direction="row" align="center" gap="3">
          <Image src="/keel-mark.svg" decorative h="mark" />
          <Text id="frame.app" fontSize="lg" weight="semibold">
            {props.data.text.app}
          </Text>
          <If when={props.data.name !== null}>
            {() => (
              <Text id="frame.name" font="mono" fontSize="xs" fg="textSecondary" px="2" py="1" border="hairline">
                {props.data.name ?? ""}
              </Text>
            )}
          </If>
        </Box>
        <Box as="nav" id="frame.nav" label={props.data.text.nav} direction="row" align="center" wrap="wrap" gap="4">
          {props.nav()}
        </Box>
      </Box>
      <Box h="hairline" bg="divider" />
      <Box
        as="main"
        id="frame.main"
        w={{ md: "measure" }}
        mx={{ md: "auto" }}
        px={{ base: "3", md: "4" }}
        py={{ base: "4", md: "6" }}
      >
        {props.children()}
      </Box>
    </Box>
  );
}
