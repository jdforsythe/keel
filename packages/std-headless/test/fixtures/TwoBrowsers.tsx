import type { Ctx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { Text } from "@keel/ui";
import { Tabs } from "../../src/index.ts";

/** Page `tb2.page`: a module client store (`tb2.view`) and a `Tabs` widget whose selection is that store. */
const View = s.object({ tab: s.enum(["a", "b"]) });
export const view = store(View, { tab: "a" }, { id: "tb2.view" });
const pick = transaction(view, "tb2.view.pick", View, (_v, p) => p);
const tabs = [
  { key: "a", text: "Apples" },
  { key: "b", text: "Bread" },
] as const;

export const c = contract("tb2", { "tb2.page": { path: "/tb2" } });

function Page(_props: unknown, ctx: Ctx) {
  return (
    <main id="tb2.page">
      <Text id="tb2.shown">{view.get("tab")}</Text>
      <Tabs
        id="tb2.tabs"
        label="Aisle"
        tabs={() => tabs}
        selected={() => view.get("tab")}
        onChange={(tab) => tx(pick, { tab })}
        panel={(k) => <Text id={`tb2.panel.text.${k}`}>{k}</Text>}
      />
    </main>
  );
}

export const routes = manifest(c, { "tb2.page": { component: Page } });
