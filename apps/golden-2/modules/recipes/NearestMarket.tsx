import type { Ctx } from "@keel/ctx";
import { computed, signal } from "@keel/reactive";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { geo } from "@keel/std-geo";
import { formatMessage } from "@keel/std-messages";
import { Box, Button, Text } from "@keel/ui";
import { LocaleParams } from "./LocaleParams.schema.ts";
import type { MarketKey } from "./MarketKey.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { nearestMarket } from "./nearestMarket.ts";

export const Props = s.object({ params: LocaleParams, text: RecipesText });

type Outcome =
  | { readonly status: "idle" }
  | { readonly status: "found"; readonly key: MarketKey; readonly km: number }
  | { readonly status: "unavailable" };

/**
 * A button that reads where the device is and names the closest market with its distance, or says the location is
 * not available. The position stays in the page: nothing sends or stores it.
 */
export default function NearestMarket(props: Infer<typeof Props>, ctx: Ctx) {
  const outcome = signal<Outcome>({ status: "idle" });
  const nameOf = (key: MarketKey): string =>
    key === "unionSquare"
      ? props.text.marketUnionSquare
      : key === "viktualien"
        ? props.text.marketViktualien
        : props.text.marketTsukiji;
  const locate = async (): Promise<void> => {
    const at = await geo(ctx).position();
    outcome.set(at.ok ? { status: "found", ...nearestMarket(at.value) } : { status: "unavailable" });
  };
  const nearest = computed(() => {
    const o = outcome.get();
    return o.status === "found"
      ? formatMessage(props.text.nearestMarket, { name: nameOf(o.key), km: o.km }, props.params.locale)
      : "";
  });
  return (
    <Box id="recipes.market" direction="column" gap="2">
      <Box direction="row">
        <Button
          id="recipes.market.find"
          onClick={() => {
            void locate();
          }}
          px="3"
          py="1"
          border="rule"
          radius="none"
          font="mono"
          fontSize="sm"
        >
          {props.text.findMarket}
        </Button>
      </Box>
      <If when={outcome.get().status === "found"}>{() => <Text id="recipes.market.nearest">{nearest.get()}</Text>}</If>
      <If when={outcome.get().status === "unavailable"}>
        {() => (
          <Text id="recipes.market.unavailable" fg="error">
            {props.text.marketUnavailable}
          </Text>
        )}
      </If>
    </Box>
  );
}
