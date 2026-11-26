import { If } from "@keel/runtime-dom";
import { Box, Button, Input } from "@keel/ui";
export default function ReplacePage() {
  // A browser Playwright drives reports `webdriver`; the server's DOM does not: the claim's render differs.
  const driven = navigator.webdriver === true;
  return (
    <Box as="main">
      <If when={driven} fallback={() => <Input id="a.first" label="Name" />}>
        <Input id="a.again" label="Name again" />
      </If>
      <Button id="a.replace.go" onClick={() => undefined}>
        Go
      </Button>
    </Box>
  );
}
