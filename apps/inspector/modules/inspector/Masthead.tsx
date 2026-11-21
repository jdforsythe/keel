import { type Infer, s } from "@keel/schema";
import { Box, Image, Text } from "@keel/ui";

export const Props = s.object({});

/** The brand masthead (docs/BRAND.md): the keel mark, the plain wordmark, and the tool's name in mono. */
export default function Masthead(_props: Infer<typeof Props>) {
  return (
    <Box as="header" direction="row" align="center" gap="3" px={{ base: "3", md: "6" }} py="4">
      <Image src="/keel-mark.svg" decorative h="mark" />
      <Text fontSize="lg" weight="semibold">
        Keel
      </Text>
      <Text font="mono" fontSize="xs" fg="textSecondary">
        inspector
      </Text>
    </Box>
  );
}
