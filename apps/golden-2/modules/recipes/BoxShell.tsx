import type { Ctx } from "@keel/ctx";
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Toaster } from "@keel/std-headless";
import { localeName } from "@keel/std-i18n";
import { tx } from "@keel/store";
import { Box, Image, Link, Text } from "@keel/ui";
import { LocaleParams } from "./LocaleParams.schema.ts";
import { TextData } from "./TextData.schema.ts";
import { dismissToast } from "./dismissToast.ts";
import { idPart } from "./idPart.ts";
import { routes } from "./routes.ts";
import { servedLocales } from "./servedLocales.ts";
import { toasts } from "./toasts.ts";

export const Props = s.object({ params: LocaleParams, data: TextData });

export const uses = [dismissToast];

const served = servedLocales.map((id) => ({ id }));

/** Layout `recipes.shell`: the page region in its locale, navigation, the locale switcher, the page in `main`, and the toasts. */
export default function BoxShell(
  props: Infer<typeof Props> & { readonly children?: () => Node },
  _slots?: undefined,
  ctx?: Ctx,
) {
  const dismiss = (id: string): void => {
    const removed = tx(dismissToast, { id });
    if (!removed.ok) return;
  };
  return (
    <Box
      id="recipes.shell"
      lang={props.params.locale}
      direction="column"
      bg="surface"
      fg="text"
      font="serif"
      fontSize="md"
    >
      <Box
        as="header"
        direction={{ base: "column", md: "row" }}
        align={{ base: "start", md: "center" }}
        justify="between"
        gap="3"
        px={{ base: "3", md: "6" }}
        py="4"
      >
        <Box direction="row" align="center" gap="3">
          <Image src="/keel-mark.svg" decorative h="mark" />
          <Text fontSize="lg" weight="semibold">
            {props.data.text.mark}
          </Text>
          <Text font="mono" fontSize="xs" fg="textSecondary">
            {props.data.text.tagline}
          </Text>
        </Box>
        <Box as="nav" id="recipes.nav" label={props.data.text.navLabel} direction="row" align="center" gap="4">
          <Link id="recipes.home" to={routes.href("recipes.index", { locale: props.params.locale })} fg="text">
            {props.data.text.home}
          </Link>
          <Link id="recipes.newLink" to={routes.href("recipes.new", { locale: props.params.locale })} fg="text">
            {props.data.text.newLink}
          </Link>
          <Link id="recipes.catalogLink" to={routes.href("recipes.catalog", { locale: props.params.locale })} fg="text">
            {props.data.text.catalogLink}
          </Link>
        </Box>
        <Box
          as="section"
          id="recipes.locales"
          label={props.data.text.localesLabel}
          direction="row"
          align="center"
          gap="3"
          font="mono"
          fontSize="xs"
        >
          <For each={served} key="id">
            {(l) => (
              <Link
                id={`recipes.locale.${idPart(l.id)}`}
                lang={l.id}
                to={routes.href("recipes.index", { locale: l.id })}
                fg="textSecondary"
              >
                {localeName(l.id)}
              </Link>
            )}
          </For>
        </Box>
      </Box>
      <Box h="hairline" bg="divider" />
      <Box as="main" id="recipes.main" w={{ md: "measure" }} mx={{ md: "auto" }} px={{ base: "3", md: "4" }} py="6">
        {props.children?.()}
      </Box>
      <Box px={{ base: "3", md: "6" }} py="4">
        {Toaster(
          {
            id: "recipes.toaster",
            items: () => toasts.get("items"),
            onDismiss: dismiss,
            dismiss: props.data.text.dismiss,
          },
          undefined,
          ctx,
        )}
      </Box>
    </Box>
  );
}
