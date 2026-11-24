import { Box, Text } from "@keel/ui";

/** A browser component: the module is listed by a `client` deployable. It reads no Node global. */
export default function Badge(props: { label: string }) {
  return (
    <Box id="shop.badge">
      <Text id="shop.badge.label">{props.label}</Text>
    </Box>
  );
}
