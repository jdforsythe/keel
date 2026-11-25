import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Input, Select, Text } from "@keel/ui";
import { CostDraft } from "./CostDraft.schema.ts";
import partsPath from "./partsPath.ts";
import { trip } from "./trip.contract.ts";
import { trip as tripStore } from "./trip.ts";

export const Props = s.object({});

export default function CostForm(_props: Infer<typeof Props>) {
  const people = tripStore.get("people");
  const f = form(CostDraft, {
    id: "trip.cost",
    initial: {
      currency: "EUR",
      parts: Object.fromEntries(people.map((p) => [p.id, "1"])),
      ...(people[0] === undefined ? {} : { payer: people[0].id }),
    },
  });
  return (
    <Form method="POST" action={trip.href("trip.show")} form={f} error={(e) => <Text role="alert">{e.message}</Text>}>
      <Box direction="column" gap="3">
        <Input id="trip.cost.title" field={f.field("title")} label="What was it for?" autocomplete="off" />
        <Input id="trip.cost.amount" field={f.field("amount")} label="Amount" autocomplete="off" />
        <Select
          id="trip.cost.currency"
          field={f.field("currency")}
          label="Currency"
          options={[
            { value: "EUR", label: "Euro" },
            { value: "GBP", label: "Pound" },
            { value: "JPY", label: "Yen" },
            { value: "USD", label: "Dollar" },
          ]}
        />
        <Select
          id="trip.cost.payer"
          field={f.field("payer")}
          label="Paid by"
          options={people.map((p) => ({ value: p.id, label: p.name }))}
        />
        <For each={people.map((p) => ({ id: p.id, name: p.name }))} key="id">
          {(p) => (
            <Input
              id={`trip.cost.parts.${p.id}`}
              field={f.field(partsPath(p.id))}
              label={`Parts for ${p.name}`}
              autocomplete="off"
            />
          )}
        </For>
        <Button id="trip.cost.add" type="submit">
          Add the cost
        </Button>
      </Box>
    </Form>
  );
}
