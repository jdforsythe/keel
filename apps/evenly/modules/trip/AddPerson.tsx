import type { Ctx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { type Infer, s } from "@keel/schema";
import { Dialog } from "@keel/std-headless";
import { line } from "@keel/std-text";
import { tx } from "@keel/store";
import { Box, Button, Input, Text } from "@keel/ui";
import { addPerson } from "./addPerson.ts";

export const Props = s.object({});
export const uses = [addPerson];

export default function AddPerson(_props: Infer<typeof Props>, ctx: Ctx) {
  const name = signal("");
  const add = (close: () => void) => {
    const written = line({ max: 60 }).parse(name.get().trim());
    if (!written.ok) return;
    const added = tx(addPerson, { person: { id: ctx.random.id("Person"), name: written.value } });
    if (!added.ok) return;
    name.set("");
    close();
  };
  return (
    <Dialog
      id="trip.addPerson"
      title="Add a person"
      trigger={() => <Text as="span">Add a person</Text>}
      content={(close) => (
        <Box direction="column" gap="3">
          <Input id="trip.addPerson.name" label="Name" autocomplete="off" value={name} onInput={(v) => name.set(v)} />
          <Button id="trip.addPerson.save" onClick={() => add(close)}>
            Add to the trip
          </Button>
        </Box>
      )}
    />
  );
}
