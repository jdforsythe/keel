import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { localeName } from "@keel/std-i18n";
import { Box, Image, Link, Text } from "@keel/ui";
import { AppLocale } from "./AppLocale.schema.ts";
import { LocaleParams } from "./LocaleParams.schema.ts";
import { TextData } from "./TextData.schema.ts";
import { idPart } from "./idPart.ts";
import { routes } from "./routes.ts";

export const Props = s.object({ params: LocaleParams, data: TextData });

/** The served locales, in declaration order, read from `AppLocale` itself. */
const served: readonly { readonly id: AppLocale }[] =
  AppLocale.node.kind === "enum"
    ? AppLocale.node.values.flatMap((v) => {
        const r = AppLocale.parse(v);
        return r.ok ? [{ id: r.value }] : [];
      })
    : [];

/** Layout `recipes.shell`: the page region in its locale, navigation, the locale switcher, and the page in `main`. */
export default function BoxShell(props: Infer<typeof Props> & { readonly children?: () => Node }) {
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
    </Box>
  );
}
