import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Text } from "@keel/ui";
import balances from "./balances.ts";
import money from "./money.ts";
import nameOf from "./nameOf.ts";
import { trip } from "./trip.ts";

export const Props = s.object({});

export default function BalancesPanel(_props: Infer<typeof Props>) {
  return (
    <Box id="trip.balances" direction="column" gap="2">
      <Text id="trip.balances.note">A positive balance is what the group owes that person.</Text>
      <Box as="ul" id="trip.balances.list" direction="column" gap="2">
        <For each={balances({ people: trip.get("people"), costs: trip.get("costs") })} key="person">
          {(b) => (
            <Box as="li" id={`trip.balances.${b.person}`}>
              {nameOf(trip.get("people"), b.person)}: {money(b.amount, trip.get("costs")[0]?.currency ?? "EUR")}
            </Box>
          )}
        </For>
      </Box>
    </Box>
  );
}
