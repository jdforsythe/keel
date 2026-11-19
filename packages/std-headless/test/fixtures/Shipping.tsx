import { type Infer, s } from "@keel/schema";
import { Button, Text } from "@keel/ui";
import { Dialog, Disclosure, Tabs } from "../../src/index.ts";

export const Props = s.object({});
type Props = Infer<typeof Props>;

const tabs = [
  { key: "box", text: "Box" },
  { key: "post", text: "Post" },
];

/** JSX usage of the widgets that take rendered content: tag children and slot props returning JSX. */
export default function Shipping(_props: Props) {
  return (
    <main>
      <Disclosure id="ship" summary={() => <Text id="ship.title">Shipping</Text>}>
        <Text id="ship.body">Ships in two days.</Text>
      </Disclosure>
      <Dialog
        id="dlg"
        title="Returns"
        trigger={() => "Open returns"}
        content={(close) => (
          <Button id="dlg.ok" onClick={close}>
            Thirty days
          </Button>
        )}
      />
      <Tabs
        id="tb"
        label="Carrier"
        tabs={() => tabs}
        selected={() => "box"}
        onChange={() => {}}
        panel={(k) => <Text id={`tb.body.${k}`}>{k}</Text>}
      />
    </main>
  );
}
