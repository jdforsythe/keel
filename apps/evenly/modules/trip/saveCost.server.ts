import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { parseMoney } from "@keel/std-money";
import { tx } from "@keel/store";
import { CostDraft } from "./CostDraft.schema.ts";
import { addCost } from "./addCost.ts";
import amountText from "./amountText.ts";
import { locale } from "./locale.ts";
import splitByParts from "./splitByParts.ts";
import { trip } from "./trip.contract.ts";
import { trip as tripStore } from "./trip.ts";

const refuse = (path: string, message: string) => err({ code: "keel.fields", message, data: { [path]: message } });

export const saveCost = action(trip, "trip.show", { input: CostDraft }, async (input, _args, ctx) => {
  const people = tripStore.get("people");
  const payer = people.find((p) => p.id === input.payer);
  if (payer === undefined) return refuse("payer", "Pick who paid.");
  const parts = people.map((p) => Number(input.parts[p.id] ?? "x"));
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 1000))
    return refuse("parts", "Write each person's parts as a whole number from 0 to 1000.");
  if (parts.every((n) => n === 0)) return refuse("parts", "Give at least one person a part of the cost.");
  const money = parseMoney(input.amount, input.currency, locale);
  if (!money.ok) return refuse("amount", amountText(money.error.code));
  if (money.value.amount < 1 || money.value.amount > 1_000_000_000)
    return refuse("amount", amountText("money.overflow"));
  const used = tripStore.get("costs")[0]?.currency;
  if (used !== undefined && used !== input.currency) return refuse("currency", `This trip keeps its costs in ${used}.`);
  const split = splitByParts(money.value.amount, parts);
  const added = tx(addCost, {
    cost: {
      id: ctx.random.id("Cost"),
      title: input.title,
      amount: money.value.amount,
      currency: money.value.currency,
      payer: payer.id,
      at: ctx.clock.now(),
      shares: people.map((p, i) => ({ person: p.id, amount: split[i] ?? 0 })),
    },
  });
  return added.ok ? ok(null) : err(added.error);
});
