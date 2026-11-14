import type { Ctx } from "@keel/ctx";
import { computed, signal } from "@keel/reactive";
import { navigate } from "@keel/router";
import { For, If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Combobox, Dialog, Disclosure, Listbox, Menu, Tabs } from "@keel/std-headless";
import { localeName } from "@keel/std-i18n";
import { formatMessage } from "@keel/std-messages";
import { formatMoney } from "@keel/std-money";
import { DataTable, TableSearch } from "@keel/std-tables";
import { durationOf, formatDate, formatDuration } from "@keel/std-temporal";
import { tx } from "@keel/store";
import { Box, Button, Heading, Link, Text } from "@keel/ui";
import { CatalogSearch } from "../kitchen/CatalogSearch.schema.ts";
import { catalogColumns } from "../kitchen/catalogColumns.ts";
import { CatalogData } from "./CatalogData.schema.ts";
import { LocaleParams } from "./LocaleParams.schema.ts";
import { addToList } from "./addToList.ts";
import { clearList } from "./clearList.ts";
import { currencyOptions } from "./currencyOptions.ts";
import { idPart } from "./idPart.ts";
import { raiseToast } from "./raiseToast.ts";
import { routes } from "./routes.ts";
import { servedLocales } from "./servedLocales.ts";
import { shoppingList } from "./shoppingList.ts";

export const Props = s.object({ params: LocaleParams, search: CatalogSearch, data: CatalogData });

export const uses = [addToList, raiseToast, clearList];

type View = "recipes" | "list";
type Key = string | number;

/** `search` without `page` (a new filter starts on page 1), keeping one of the two filters, with `change` applied. */
function queryWith(
  { page: _page, currency, favorite, ...rest }: CatalogSearch,
  keep: "currency" | "favorite",
  change: Pick<CatalogSearch, "currency" | "favorite">,
): CatalogSearch {
  const kept =
    keep === "currency" ? (currency === undefined ? {} : { currency }) : favorite === undefined ? {} : { favorite };
  return { ...rest, ...kept, ...change };
}

/**
 * Route `recipes.catalog`: a finder that opens a recipe, a currency filter, and two tabs: the recipes table (sorted,
 * searched, filtered and paged through the URL, with row selection and a menu per row) with a button that adds the
 * selection to the shopping list, and the shopping list with a confirmed clear.
 */
export default function CatalogPage(props: Infer<typeof Props>, _slots?: undefined, ctx?: Ctx) {
  const typed = signal("");
  const view = signal<View>("recipes");
  const picked = signal<readonly Key[]>([]);
  const href = (q: CatalogSearch) => routes.href("recipes.catalog", { locale: props.params.locale }, q);
  const refine = (keep: "currency" | "favorite", change: Pick<CatalogSearch, "currency" | "favorite">) =>
    queryWith(props.search, keep, change);
  const found = computed(() => {
    const q = typed.get().toLocaleLowerCase(props.params.locale);
    return props.data.recipes
      .filter((r) => r.title.toLocaleLowerCase(props.params.locale).includes(q))
      .map((r) => ({ key: r.id, text: r.title }));
  });
  const nothingPicked = computed(() => picked.get().length === 0);
  const add = (): void => {
    const keys = new Set(picked.get());
    const chosen = props.data.recipes.filter((r) => keys.has(r.id)).map((r) => ({ id: r.id, title: r.title }));
    const added = tx(addToList, { recipes: chosen });
    if (!added.ok) return;
    const raised = tx(raiseToast, {
      text: formatMessage(props.data.text.addedToList, { n: chosen.length }, props.params.locale),
    });
    if (!raised.ok) return;
  };
  const clear = (close: () => void): void => {
    const cleared = tx(clearList, {});
    if (cleared.ok) close();
  };

  const recipesPanel = (): Node => (
    <Box id="recipes.catalog.recipes" direction="column" gap="4" py="4">
      <TableSearch id="recipes.search" label={props.data.text.searchLabel} search={props.search} href={href} />
      <Box
        as="nav"
        id="recipes.catalog.show"
        label={props.data.text.showLabel}
        direction="row"
        gap="4"
        font="mono"
        fontSize="sm"
      >
        <Link id="recipes.catalog.all" to={href(refine("currency", {}))} fg="text">
          {props.data.text.filterAll}
        </Link>
        <Link id="recipes.catalog.favorites" to={href(refine("currency", { favorite: true }))} fg="text">
          {props.data.text.filterFavorites}
        </Link>
      </Box>
      <DataTable
        id="recipes.table"
        styles={{
          table: { fontSize: "sm" },
          header: { px: "2", py: "2", font: "mono", fontSize: "xs" },
          cell: { px: "2", py: "2" },
          sort: { fg: "text" },
          pager: { py: "3", gap: "4", font: "mono", fontSize: "sm" },
          previous: { fg: "text" },
          next: { fg: "text" },
        }}
        label={props.data.text.tableLabel}
        columns={catalogColumns}
        search={props.search}
        href={href}
        locale={props.params.locale}
        page={props.data.page}
        selected={() => picked.get()}
        onSelect={(keys) => picked.set(keys)}
        text={{
          headers: {
            title: props.data.text.titleLabel,
            price: props.data.text.priceLabel,
            minutes: props.data.text.minutesLabel,
            addedOn: props.data.text.addedLabel,
            favorite: props.data.text.favorite,
          },
          pager: props.data.text.pagerLabel,
          previous: props.data.text.previous,
          next: props.data.text.next,
          pageOf: (page, pages) => formatMessage(props.data.text.pageOf, { page, pages }, props.params.locale),
          selectAll: props.data.text.selectAll,
          selectRow: (row) => formatMessage(props.data.text.selectRow, { title: row.title }, props.params.locale),
          actions: props.data.text.actionsLabel,
        }}
        cells={{
          price: (row) => (
            <Text id={`recipes.table.price.${idPart(row.id)}`}>{formatMoney(row.price, props.params.locale)}</Text>
          ),
          minutes: (row) => (
            <Text id={`recipes.table.minutes.${idPart(row.id)}`}>
              {formatDuration(durationOf(row.minutes * 60_000), props.params.locale, "short")}
            </Text>
          ),
          addedOn: (row) => (
            <Text id={`recipes.table.added.${idPart(row.id)}`}>
              {formatDate(row.addedOn, props.params.locale, "long")}
            </Text>
          ),
          favorite: (row) => (
            <Text id={`recipes.table.favorite.${idPart(row.id)}`}>
              {row.favorite ? props.data.text.yes : props.data.text.no}
            </Text>
          ),
        }}
        actions={(row) => (
          <Menu
            id={`recipes.menu.${idPart(row.id)}`}
            styles={{
              trigger: { px: "3", py: "1", border: "rule", radius: "none", font: "mono", fontSize: "sm" },
              menu: { bg: "card", border: "hairline", p: "1", m: "0" },
              item: { px: "3", py: "1", states: { highlighted: { bg: "text", fg: "card" } } },
            }}
            trigger={() => formatMessage(props.data.text.rowActions, { title: row.title }, props.params.locale)}
            items={() => [
              { key: "open", text: props.data.text.openRecipe },
              ...servedLocales.filter((l) => l !== props.params.locale).map((l) => ({ key: l, text: localeName(l) })),
            ]}
            onSelect={(key) => {
              const locale = key === "open" ? props.params.locale : key;
              void navigate(routes.href("recipes.show", { locale, recipeId: row.id }));
            }}
          />
        )}
        empty={() => <Text id="recipes.table.none">{props.data.text.empty}</Text>}
      />
      <Box direction="row">
        <Button
          id="recipes.addSelected"
          onClick={add}
          disabled={nothingPicked}
          font="mono"
          fontSize="sm"
          px="4"
          py="2"
          bg="text"
          fg="card"
          border="rule"
          radius="none"
        >
          {props.data.text.addSelected}
        </Button>
      </Box>
    </Box>
  );

  const listPanel = (): Node => (
    <Box id="recipes.shopping" direction="column" gap="4" py="4">
      <If when={shoppingList.get("recipes").length === 0}>
        {() => (
          <Text id="recipes.shopping.empty" font="mono" fontSize="sm" fg="textSecondary">
            {props.data.text.listEmpty}
          </Text>
        )}
      </If>
      <Box as="ul" id="recipes.shopping.items" direction="column" gap="2" p="0" m="0">
        <For each={shoppingList.get("recipes")} key="id">
          {(r) => (
            <Box as="li" id={`recipes.shopping.item.${idPart(r.id)}`}>
              {r.title}
            </Box>
          )}
        </For>
      </Box>
      <Dialog
        id="recipes.clear"
        styles={{
          trigger: { px: "3", py: "1", border: "rule", radius: "none", font: "mono", fontSize: "sm" },
          dialog: { bg: "card", fg: "text", border: "rule", p: "4" },
        }}
        title={props.data.text.clearList}
        trigger={() => props.data.text.clearList}
        alert={{ description: props.data.text.clearBody }}
        content={(close) => (
          <Box direction="row" gap="3">
            <Button id="recipes.clear.cancel" onClick={close} px="4" py="2" border="rule" radius="none">
              {props.data.text.cancel}
            </Button>
            <Button
              id="recipes.clear.confirm"
              onClick={() => clear(close)}
              px="4"
              py="2"
              bg="text"
              fg="card"
              border="rule"
              radius="none"
            >
              {props.data.text.confirmClear}
            </Button>
          </Box>
        )}
      />
    </Box>
  );

  return (
    <Box as="section" id="recipes.catalog" direction="column" gap="5">
      <Heading id="recipes.catalog.title" level={1} fontSize="2xl" weight="semibold" m="0">
        {props.data.text.catalogHeading}
      </Heading>
      <Combobox
        id="recipes.find"
        styles={{
          input: { px: "2", py: "1", border: "rule", radius: "none" },
          list: { bg: "card", border: "hairline", p: "0", m: "0" },
          option: { px: "3", py: "1", states: { highlighted: { bg: "text", fg: "card" } } },
        }}
        label={props.data.text.findLabel}
        text={() => typed.get()}
        onInput={(t) => typed.set(t)}
        options={() => found.get()}
        onChange={(recipeId) => {
          void navigate(routes.href("recipes.show", { locale: props.params.locale, recipeId }));
        }}
        empty={() => props.data.text.findEmpty}
      />
      <Disclosure
        id="recipes.catalogFilters"
        styles={{
          button: { px: "3", py: "1", border: "rule", radius: "none", font: "mono", fontSize: "sm" },
          panel: { py: "2" },
        }}
        summary={() => props.data.text.filtersLabel}
        {...{
          children: () => (
            <Listbox
              id="recipes.currency"
              styles={{
                list: { border: "hairline", p: "0", m: "0" },
                option: {
                  px: "3",
                  py: "1",
                  states: { highlighted: { bg: "text", fg: "card" }, selected: { weight: "semibold" } },
                },
              }}
              label={props.data.text.currencyLabel}
              mode="single"
              options={() => [
                { key: "any", text: props.data.text.currencyAny },
                ...currencyOptions.map((c) => ({ key: c, text: c })),
              ]}
              selected={() => [props.search.currency ?? "any"]}
              onChange={(keys) => {
                const [key] = keys;
                void navigate(href(refine("favorite", key === undefined || key === "any" ? {} : { currency: key })));
              }}
            />
          ),
        }}
      />
      <Tabs
        id="recipes.views"
        styles={{
          tab: { px: "3", py: "2", font: "mono", fontSize: "sm", states: { selected: { weight: "semibold" } } },
          panel: { py: "2" },
        }}
        label={props.data.text.viewsLabel}
        tabs={() => [
          { key: "recipes", text: props.data.text.tabRecipes },
          { key: "list", text: props.data.text.tabList },
        ]}
        selected={() => view.get()}
        onChange={(key) => view.set(key)}
        panel={(key) => (key === "recipes" ? recipesPanel() : listPanel())}
      />
    </Box>
  );
}
