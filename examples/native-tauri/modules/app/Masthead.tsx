import { type Infer, s } from "@keel/schema";
import { Box, Image, Text } from "@keel/ui";

export const Props = s.object({});

/** The brand masthead (docs/BRAND.md): the keel mark and the app's name. */
export default function Masthead(_props: Infer<typeof Props>) {
  return (
    <Box as="header" direction="row" align="center" gap="3" px="4" py="4">
      <Image src="/keel-mark.svg" decorative h="mark" />
      <Text font="mono" fontSize="sm">
        native-tauri
      </Text>
    </Box>
  );
}
