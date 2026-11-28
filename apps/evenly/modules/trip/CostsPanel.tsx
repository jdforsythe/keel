import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Text } from "@keel/ui";
import CostForm from "./CostForm.tsx";
import money from "./money.ts";
import nameOf from "./nameOf.ts";
import { trip } from "./trip.ts";

export const Props = s.object({});

export default function CostsPanel(_props: Infer<typeof Props>) {
  return (
    <Box id="trip.costs" direction="column" gap="3">
      <Text id="trip.costs.status" role="status">
        {trip.get("costs").length} costs on this trip.
      </Text>
      <Box as="ul" id="trip.costs.list" direction="column" gap="2">
        <For each={trip.get("costs")} key="id">
          {(c) => (
            <Box as="li" id={`trip.costs.${c.id}`}>
              {c.title}, {money(c.amount, c.currency)}, paid by {nameOf(trip.get("people"), c.payer)}
            </Box>
          )}
        </For>
      </Box>
      <For each={[{ people: trip.get("people").length }]} key="people">
        {() => <CostForm />}
      </For>
    </Box>
  );
}
