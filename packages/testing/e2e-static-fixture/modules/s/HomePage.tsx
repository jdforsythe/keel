import { Box, Button, Text } from "@keel/ui";
export default function HomePage() {
  return (
    <Box id="s.page">
      <Text id="s.page.text">Held</Text>
      <Button id="s.page.more" onClick={() => undefined}>
        More
      </Button>
    </Box>
  );
}
