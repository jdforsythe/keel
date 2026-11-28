// The routes module of the two-harnesses suite (not a test file). The test imports it for the server side (the `app`);
// `renderRoute` imports it again with `routes: () => import(...)`, one module graph per harness.
// One `node` module `og`; page `og.page` (`/p`): a client store `og.count` (button `og.inc`, text `og.n`), a `Tabs` widget (`og.tabs`),
// a `Form` (`og.note`, `og.save`) whose action writes `ctx.storage` key `og.note`, and text `og.server` (the loader's read of it).
// The server side's ctx is `control.ctx`, set by the test.
import type { Ctx } from "@keel/ctx";
import * as forms from "@keel/forms";
import * as reactive from "@keel/reactive";
import { Form, action, loader, manifest } from "@keel/router";
import * as router from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import * as schema from "@keel/schema";
import * as headless from "@keel/std-headless";
import * as store from "@keel/store";
import * as ui from "@keel/ui";
import { compilePage } from "./resume-support.ts";

export { Form };
export const control: { ctx: Ctx | undefined } = { ctx: undefined };

const Data = s.object({ note: s.string() });
const Note = s.object({ note: s.string({ min: 1 }) });
export const oc = contract("og", { "og.page": { path: "/p" } });

const PAGE = `import { signal } from "@keel/reactive";
import { Form } from "@keel/router";
import { form } from "@keel/forms";
import { s } from "@keel/schema";
import { Tabs } from "@keel/std-headless";
import { store, transaction, tx } from "@keel/store";
import { Box, Button, Input, Text } from "@keel/ui";
const Count = s.object({ n: s.int() });
const Note = s.object({ note: s.string({ min: 1 }) });
export default function Page(props) {
  const count = store(Count, { n: 0 }, { id: "og.count" });
  const inc = transaction(count, "og.inc", s.object({}), (state) => ({ n: state.n + 1 }));
  const current = signal("one");
  const f = form(Note);
  return <Box id="og.root">
    <Text id="og.n">{String(count.get("n"))}</Text>
    <Text id="og.server">{props.data.note}</Text>
    <Button id="og.inc" onClick={() => { tx(inc, {}); }}>inc</Button>
    <Tabs id="og.tabs" label="Sections" tabs={() => [{ key: "one", text: "One" }, { key: "two", text: "Two" }]} selected={() => current.get()} onChange={(k) => { current.set(k); }} panel={(k) => <Text id={"og.body." + k}>{"Body " + k}</Text>} />
    <Form method="POST" action="/p" form={f}>
      <Input id="og.note" field={f.field("note")} label="Note" />
      <Button id="og.save" type="submit">save</Button>
    </Form>
  </Box>
}
`;
const modules = {
  "@keel/ui": ui,
  "@keel/router": router,
  "@keel/forms": forms,
  "@keel/schema": schema,
  "@keel/reactive": reactive,
  "@keel/std-headless": headless,
  "@keel/store": store,
};

export const routes = manifest(oc, {
  "og.page": {
    component: compilePage("og.page", PAGE, modules),
    loader: loader(oc, "og.page", { output: Data }, async () =>
      ok({ note: (await control.ctx?.storage.get("og.note")) ?? "" }),
    ),
    POST: action(oc, "og.page", { input: Note }, async ({ note }) => {
      await control.ctx?.storage.set("og.note", note);
      return ok(oc.href("og.page"));
    }),
  },
});

export default routes;
