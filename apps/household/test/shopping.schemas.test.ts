import { expect, it } from "vitest";
import { AddPayload } from "../modules/shopping/AddPayload.schema.ts";
import { ItemRef } from "../modules/shopping/ItemRef.schema.ts";
import { ListParams } from "../modules/shopping/ListParams.schema.ts";
import { ListText } from "../modules/shopping/ListText.schema.ts";
import { NewItem } from "../modules/shopping/NewItem.schema.ts";
import { OutboxText } from "../modules/shopping/OutboxText.schema.ts";
import { RestockText } from "../modules/shopping/RestockText.schema.ts";
import { Run } from "../modules/shopping/Run.schema.ts";
import { RunsCopy } from "../modules/shopping/RunsCopy.schema.ts";
import { ShowPayload } from "../modules/shopping/ShowPayload.schema.ts";
import { ViewState } from "../modules/shopping/ViewState.schema.ts";
import { WriteKey } from "../modules/shopping/WriteKey.schema.ts";
import { restock } from "../modules/shopping/restock.server.ts";
import { restockChart } from "../modules/shopping/restockChart.ts";
import { restockText } from "../modules/shopping/restockText.ts";
import { runsChannel } from "../modules/shopping/runsChannel.schema.ts";
import { runsCopy } from "../modules/shopping/runsCopy.store.ts";
import { acceptsGenerated, rejectsAt, survivesJson } from "./schemas.ts";

it("generates every shape of the shopping module that parses and survives the wire", () => {
  for (const schema of [
    AddPayload,
    ItemRef,
    ListParams,
    NewItem,
    Run,
    RunsCopy,
    ShowPayload,
    ViewState,
    WriteKey,
    OutboxText,
    RestockText,
    ListText,
  ]) {
    acceptsGenerated(schema, 50);
    survivesJson(schema, 50);
  }
});

it("takes a new item as a name of 1 to 60 characters, an add payload with an id too, and a reference with an id", () => {
  expect(NewItem.parse({ name: "Milk" }).ok).toBe(true);
  expect(NewItem.parse({ name: "n".repeat(60) }).ok).toBe(true);
  rejectsAt(NewItem, { name: "" }, "name");
  rejectsAt(NewItem, { name: "   " }, "name");
  rejectsAt(NewItem, { name: "n".repeat(61) }, "name");
  rejectsAt(NewItem, {}, "name");
  expect(AddPayload.parse({ id: "item-1", name: "Milk" }).ok).toBe(true);
  rejectsAt(AddPayload, { id: "", name: "Milk" }, "id");
  rejectsAt(AddPayload, { id: "item-1", name: "" }, "name");
  rejectsAt(ItemRef, {}, "id");
  rejectsAt(ItemRef, { id: "" }, "id");
  expect(ListParams.parse({}).ok).toBe(true);
});

it("shows one of two tabs, and the weekly run's counts stay within the 50 staples a run can hold", () => {
  for (const show of ["toBuy", "bought"]) {
    expect(ShowPayload.parse({ show }).ok).toBe(true);
    expect(ViewState.parse({ show }).ok).toBe(true);
  }
  rejectsAt(ShowPayload, { show: "all" }, "show");
  rejectsAt(ViewState, { show: "" }, "show");
  const run = {
    by: "member",
    at: "2026-06-13T08:00:00.000Z",
    state: "running",
    putBack: 1,
    handled: 2,
    total: 5,
    code: "",
  };
  expect(Run.parse(run).ok).toBe(true);
  for (const [key, value] of [
    ["putBack", 51],
    ["handled", -1],
    ["total", 51],
    ["state", "paused"],
    ["by", "robot"],
    ["at", "yesterday"],
    ["code", "c".repeat(81)],
  ] as const)
    rejectsAt(Run, { ...run, [key]: value }, key);
  expect(RunsCopy.parse({ runs: { last: null, kept: 0 }, read: false }).ok).toBe(true);
  expect(RunsCopy.parse({ runs: { last: run, kept: 1 }, read: true }).ok).toBe(true);
  rejectsAt(RunsCopy, { runs: { last: null, kept: -1 }, read: true }, "runs.kept");
  rejectsAt(RunsCopy, { runs: { last: null, kept: 0 } }, "read");
});

it("keys a write by its owner, and keeps each staple's key as a slug a widget can address", () => {
  expect(WriteKey.parse({ owner: "u1", key: "Write_1" }).ok).toBe(true);
  rejectsAt(WriteKey, { owner: "u1" }, "key");
  rejectsAt(WriteKey, { key: "Write_1" }, "owner");
  const text = {
    heading: "H",
    addStaple: "A",
    views: "V",
    toBuy: "B",
    bought: "Bo",
    markBought: "M",
    putBack: "P",
    remove: "R",
    empty: "E",
    help: "H",
    helpBody: "B",
    failed: "F",
    dismiss: "D",
    outbox: {
      heading: "H",
      waiting: "w",
      waitingBought: "wb",
      waitingBack: "wk",
      conflict: "c",
      gone: "g",
      otherMember: "o",
      refused: "r",
      goneItem: "i",
      mineBought: "m",
      mineBack: "m",
      theirs: "t",
      dismiss: "d",
    },
    live: { live: "l", connecting: "c", offline: "o", denied: "d" },
  };
  expect(ListText.parse({ ...text, staples: [{ key: "milk-2", text: "Milk" }] }).ok).toBe(true);
  for (const key of ["Milk", "has space", "", "a_b", "-a", "a--b", "k".repeat(65)])
    rejectsAt(ListText, { ...text, staples: [{ key, text: "Milk" }] }, "staples.0.key");
  rejectsAt(ListText, { ...text, heading: "" }, "heading");
  rejectsAt(OutboxText, { ...text.outbox, dismiss: "" }, "dismiss");
  rejectsAt(RestockText, { ...restockText, runNow: "" }, "runNow");
});

it("ships the weekly panel's English words in the shape its schema asks, and names its workflow and channel", () => {
  expect(RestockText.parse(restockText).ok).toBe(true);
  expect(restock.id).toBe("shopping.restock");
  expect(Object.keys(restock.jobs).sort()).toEqual([
    "shopping.restock.forget",
    "shopping.restock.putting",
    "shopping.restock.wake",
  ]);
  expect(restockChart.events).toBeDefined();
  expect(runsChannel.path).toBe("/api/restock/events");
  expect(runsChannel.events.parse({ kind: "changed" }).ok).toBe(true);
  expect(runsChannel.events.parse({ kind: "closed", reason: "denied" }).ok).toBe(true);
  expect(runsChannel.events.parse({ kind: "closed" }).ok).toBe(false);
});

it("keeps the page's copy of the weekly runs empty and unread until a read hydrates it", () => {
  expect(runsCopy.get("read")).toBe(false);
  expect(runsCopy.get("runs")).toEqual({ last: null, kept: 0 });
});
