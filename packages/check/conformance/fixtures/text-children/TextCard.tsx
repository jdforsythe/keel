import { Box, Text } from "@keel/ui";
import { text } from "./text.contract.ts";

/** Every JSX child here is text: a string, a number, a contract `href`, or a called slot. */
export function TextCard(props: { label: string; count: number; icon: () => string; children: () => string }) {
  return (
    <Box id="text.card">
      <Text id="text.label">{props.label}</Text>
      <Text id="text.count">{props.count}</Text>
      <Text id="text.string">{String(props.count)}</Text>
      <Text id="text.href">{text.href("text.show")}</Text>
      <Text id="text.icon">{props.icon()}</Text>
      <Text id="text.slot">{props.children()}</Text>
      <Text id="text.literal">{"plain"}</Text>
    </Box>
  );
}
