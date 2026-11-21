// E2406 literal copy reached through JSX expression children and literal branches, and the shapes it leaves alone.
import "@keel/std-messages/tools";
import { describe, expect, it } from "vitest";
import { codesOf, tree } from "../conformance/fixtures/support.ts";

const view = (body: string): string =>
  `export default function RecipeList(props) {\n  const t = props.data.text\n  return ${body}\n}\n`;
const hits = (body: string): string[] =>
  codesOf(tree({ "modules/recipes/RecipeList.tsx": view(body) }), "E2406").map((d) => d.message);
const routes = (title: string): string =>
  `import { manifest } from '@keel/router'\nimport RecipeList from './RecipeList.tsx'\nexport const routes = manifest({ 'recipes.list': { path: '/:locale/recipes', component: RecipeList, title: ${title} } })\n`;
const titleHits = (title: string): string[] =>
  codesOf(tree({ "modules/recipes/routes.ts": routes(title) }), "E2406").map((d) => d.message);

describe("E2406 literal copy it reports", () => {
  it.each([
    ["a string literal child", "<h1>{'Recipes'}</h1>", ["Recipes"]],
    ["a template literal child", "<h1>{`Recipes`}</h1>", ["Recipes"]],
    ["a ternary of literals as a child", "<p>{props.x ? 'Yes' : 'No'}</p>", ["Yes", "No"]],
    ["a logical fallback child", "<p>{props.x || 'Untitled'}</p>", ["Untitled"]],
    ["an and-guarded literal child", "<p>{props.x && 'Saved'}</p>", ["Saved"]],
    ["a thunk child returning literals", "<p>{() => (props.x ? 'Open' : t.closed)}</p>", ["Open"]],
    ["a fragment child", "<>{'Recipes'}</>", ["Recipes"]],
    ["a ternary label", "<Field label={props.x ? 'A' : 'B'} />", ["A", "B"]],
  ])("%s", (_, body, words) => {
    expect(hits(body)).toEqual(words.map((w) => `literal copy '${w}'; read it from a message set`));
  });

  it("a route title returning a conditional of literals", () => {
    expect(titleHits("(p) => (p.params.x ? 'Recipes' : 'Rezepte')")).toHaveLength(2);
    expect(titleHits("function (p) { return p.params.x ? 'Recipes' : p.data.text.title }")).toHaveLength(1);
  });
});

describe("E2406 shapes it leaves alone", () => {
  it.each([
    ["a token-valued attribute ternary", "<Box fg={props.x ? 'accent' : 'textSecondary'} />"],
    ["a letterless fallback child", "<p>{props.data.email ?? ''}</p>"],
    ["a thunk child returning an element", "<p>{() => <Text id='accounts.signedIn'>{t.signedIn}</Text>}</p>"],
    ["a condition literal, message branches", "<p>{props.x === 'draft' ? t.draft : t.live}</p>"],
    ["a call argument in a child", "<p>{formatNumber(props.n, 'de-DE')}</p>"],
    ["a letterless ternary child", "<p>{props.x ? ' · ' : ''}</p>"],
    ["message reads as children", "<p>{t.title} {t.count}</p>"],
    ["a map of elements", "<ul>{props.items.map((i) => <li>{i.name}</li>)}</ul>"],
    ["an element-valued ternary", "<p>{props.x ? <b>{t.a}</b> : null}</p>"],
  ])("%s", (_, body) => {
    expect(hits(body)).toEqual([]);
  });

  it("a route title reading a message set", () => {
    expect(titleHits("(p) => (p.params.x ? p.data.text.a : p.data.text.b)")).toEqual([]);
  });
});
