// @vitest-environment node
// Backlog 0166, rfc:0062: under plain node, an edit page's `@keel/ui` controls show their values in the server
// HTML (the `value` attribute, textarea text, `selected`, `checked`), the defaults a browser shows before resume.
// The `field` path (`Field.bind`) is the same write; apps/golden-1/test/ssrNode.test.ts serves its edit page.
import { createCtx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { Checkbox, Input, Select, TextArea } from "@keel/ui";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const Todo = s.object({ title: s.string(), notes: s.string(), priority: s.string(), done: s.boolean() });

const c = contract("app", { "app.edit": { path: "/edit" } });
const load = loader(c, "app.edit", { output: Todo }, async () =>
  ok({ title: 'Milk & "eggs"', notes: "<b>x</b>\nsecond", priority: "high", done: true }),
);

const edit = (data: s.infer<typeof Todo>): Node => {
  const main = document.createElement("main");
  main.append(
    Input({ label: "Title", value: signal(data.title) }),
    Input({ label: "Password", type: "password", value: signal("hunter2") }),
    TextArea({ label: "Notes", value: signal(data.notes) }),
    Select({
      label: "Priority",
      value: signal(data.priority),
      options: [
        { value: "low", label: "Low" },
        { value: "high", label: "High" },
      ],
    }),
    Checkbox({ label: "Done", checked: signal(data.done) }),
  );
  return main;
};

describe("server-rendered controls show their values (backlog 0166)", () => {
  it("an edit page under createApp in plain node carries each value in its markup", async () => {
    expect(typeof document).toBe("undefined");
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes: manifest(c, {
        "app.edit": {
          loader: load,
          component: (props) => {
            const data = Reflect.get(Object(props), "data");
            const r = Todo.parse(data);
            if (!r.ok) throw new Error("fixture: loader data");
            return edit(r.value);
          },
        },
      }),
      ctx: createCtx({ mode: "sim", seed: 1 }),
    });
    const res = await app.fetch(new Request("http://localhost/edit", { headers: { accept: "text/html" } }));
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toMatch(
      /<input type="text" id="[^"]+" data-k="" class="k-control" value="Milk &amp; &quot;eggs&quot;">/,
    );
    expect(html).toContain(">&lt;b&gt;x&lt;/b&gt;\nsecond</textarea>");
    expect(html).toContain('<option value="high" selected="">High</option>');
    expect(html).toContain('<option value="low">Low</option>');
    expect(html).toMatch(/<input type="checkbox" id="[^"]+" data-k="" checked="">/);
    expect(html).not.toContain("hunter2");
  });
});
