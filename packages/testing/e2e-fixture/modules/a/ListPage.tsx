import { Box, Button, Input } from "@keel/ui";
export default function ListPage() {
  return (
    <Box as="main">
      <Input id="a.name" label="Name" />
      <Button id="a.list.go" onClick={() => undefined}>
        Go
      </Button>
    </Box>
  );
}
