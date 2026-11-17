import { properties, render } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { A11yEntry } from "../modules/inspector/A11yEntry.schema.ts";
import { Graph } from "../modules/inspector/Graph.schema.ts";
import GraphView from "../modules/inspector/GraphView.tsx";
import { IdEntry } from "../modules/inspector/IdEntry.schema.ts";
import IdsView from "../modules/inspector/IdsView.tsx";
import InspectError from "../modules/inspector/InspectError.tsx";
import InspectorPage from "../modules/inspector/InspectorPage.tsx";
import { LogEntry } from "../modules/inspector/LogEntry.schema.ts";
import { RouteEntry } from "../modules/inspector/RouteEntry.schema.ts";
import { SectionView } from "../modules/inspector/SectionView.schema.ts";
import SectionsView from "../modules/inspector/SectionsView.tsx";
import { StoreView } from "../modules/inspector/StoreView.schema.ts";
import StoresView from "../modules/inspector/StoresView.tsx";
import { inspectApi } from "../modules/inspector/inspectApi.service.ts";
import "../modules/inspector/routes.ts";

const graph = {
  nodes: [
    { id: 1, kind: "scope" },
    { id: 2, kind: "signal" },
    { id: 3, kind: "signal" },
    { id: 4, kind: "effect" },
  ],
  edges: [
    { from: 2, to: 4 },
    { from: 3, to: 4 },
  ],
} as const;
const entry = (id: number, name: string) => ({ id, name, at: id });
const ids = {
  "todos.undo": {
    file: "modules/todos/AppShell.tsx",
    line: 15,
    col: 9,
    component: "AppShell",
    tag: "button",
    role: "button",
  },
  "todos.main": {
    file: "modules/todos/AppShell.tsx",
    line: 17,
    col: 7,
    component: "AppShell",
    tag: "main",
    role: null,
  },
};
const a11y = { "todos.undo": { role: "button", name: "text", tag: "button" } } as const;

describe("GraphView", () => {
  it("groups nodes by kind in a fixed order, skips empty kinds, and names what each node reads", () => {
    expect(Graph.parse(graph).ok).toBe(true);
    const t = render(GraphView, { props: { graph } });
    expect(t.find("inspector.graph.counts").text).toBe("4 nodes, 2 edges");
    expect(t.a11y("inspector.graph").children.map((c) => c.id)).toEqual([
      "inspector.graph.title",
      "inspector.graph.counts",
      "inspector.graph.scope",
      "inspector.graph.signal",
      "inspector.graph.effect",
    ]);
    expect(t.find("inspector.graph.signal.title").text).toBe("signal (2)");
    expect(t.find("inspector.node.2").text).toBe("#2");
    expect(t.find("inspector.node.4").text).toBe("#4 reads #2, #3");
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(GraphView);
  });
});

describe("StoresView", () => {
  it("lists stores by id with state and log; the last entry carries the undo marker", () => {
    const stores = {
      "todos.board": { state: '{"lists":[]}', log: [entry(1, "todos.addList"), entry(2, "todos.addTodo")] },
      "app.empty": { state: "{}", log: [] },
    };
    for (const st of Object.values(stores))
      expect(StoreView.parse(st).ok && st.log.every((e) => LogEntry.parse(e).ok)).toBe(true);
    const t = render(StoresView, { props: { stores } });
    expect(t.a11y("inspector.stores").children.map((c) => c.id)).toEqual([
      "inspector.stores.title",
      "inspector.store.app.empty",
      "inspector.store.todos.board",
    ]);
    expect(t.find("inspector.store.todos.board.state").text).toBe('{"lists":[]}');
    expect(t.find("inspector.store.todos.board.count").text).toBe("Log: 2 entries");
    expect(t.find("inspector.store.todos.board.entry.1").text).toBe("1 todos.addList at 1");
    expect(t.find("inspector.store.todos.board.entry.2").text).toBe("2 todos.addTodo at 2 (undo reverts this)");
    expect(t.find("inspector.store.app.empty.count").text).toBe("Log empty: nothing to undo");
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(StoresView);
  });
});

describe("IdsView", () => {
  it("lists every id sorted with its location and a11y expectation", () => {
    for (const e of Object.values(ids)) expect(IdEntry.parse(e).ok).toBe(true);
    expect(A11yEntry.parse(a11y["todos.undo"]).ok).toBe(true);
    const t = render(IdsView, { props: { ids, a11y } });
    expect(t.find("inspector.ids.counts").text).toBe("2 ids, 1 a11y expectations");
    expect(t.a11y("inspector.ids.list").children.map((c) => c.id)).toEqual([
      "inspector.id.todos.main",
      "inspector.id.todos.undo",
    ]);
    expect(t.find("inspector.id.todos.undo").text).toBe(
      "todos.undo: button in AppShell modules/todos/AppShell.tsx:15:9; button, name from text",
    );
    expect(t.find("inspector.id.todos.main").text).toBe(
      "todos.main: main in AppShell modules/todos/AppShell.tsx:17:7; no a11y entry",
    );
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(IdsView);
  });
});

describe("SectionsView", () => {
  it("renders each section generically: id, the schema doc as its type, the value as JSON text or the E1057", () => {
    const sections = {
      "orders.recent": { doc: "{ n: int }", text: '{"n":2}', failed: false },
      "audit.tail": {
        doc: "string[]",
        text: "E1057 inspector section audit.tail fails its schema at 0 (type)",
        failed: true,
      },
    };
    for (const v of Object.values(sections)) expect(SectionView.parse(v).ok).toBe(true);
    const t = render(SectionsView, { props: { sections } });
    expect(t.find("inspector.sections.count").text).toBe("2 sections");
    expect(t.a11y("inspector.sections").children.map((c) => c.id)).toEqual([
      "inspector.sections.title",
      "inspector.sections.count",
      "inspector.section.audit.tail",
      "inspector.section.orders.recent",
    ]);
    expect(t.find("inspector.section.orders.recent.doc").text).toBe("Type: { n: int }");
    expect(t.find("inspector.section.orders.recent.value").text).toBe('{"n":2}');
    expect(t.find("inspector.section.audit.tail.value").text).toBe(
      "Failed: E1057 inspector section audit.tail fails its schema at 0 (type)",
    );
    t.dispose();
  });

  it("with no sections it says so", () => {
    const t = render(SectionsView, { props: { sections: {} } });
    expect(t.find("inspector.sections.count").text).toBe("No sections registered");
    t.dispose();
  });
});

describe("InspectorPage", () => {
  it("composes the three views under the target and live line", () => {
    expect(RouteEntry.parse({ path: null, module: "todos" }).ok).toBe(true);
    const data = {
      url: "http://localhost:4180",
      live: true,
      graph,
      stores: { "todos.board": { state: "{}", log: [] } },
      ids,
      a11y,
      routes: { "todos.index": { path: "/", module: "todos" } },
      sections: {},
    };
    const t = render(InspectorPage, { props: { search: {}, data } });
    expect(t.find("inspector.title").text).toBe("Inspector: http://localhost:4180");
    expect(t.a11y("inspector.page").children.map((c) => c.id)).toEqual([
      "inspector.title",
      "inspector.live",
      "inspector.routes",
      "inspector.graph",
      "inspector.stores",
      "inspector.ids",
      "inspector.sections",
    ]);
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(InspectorPage);
  });
});

describe("InspectError", () => {
  it("names the target that failed and how to fix it", () => {
    const t = render(InspectError, {
      props: { error: { code: "inspector.unreachable", message: "http://localhost:1 is unreachable" } },
    });
    expect(t.find("inspector.error.message").text).toBe("http://localhost:1 is unreachable");
    expect(t.find("inspector.error.hint").text).toContain("?url=");
    t.dispose();
  });
});

describe("inspectApi", () => {
  it("declares GET /__keel/inspect", () => {
    expect(inspectApi.get).toMatchObject({ method: "GET", path: "/__keel/inspect" });
  });
});
