import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Home } from "./Home.schema.ts";
import { api } from "./api.server.ts";
import { app } from "./app.contract.ts";

export const loadHome = loader(app, "app.home", { output: Home }, async (_args, ctx) => {
  const quote = await api.getQuote({ params: { id: "q1" } }, ctx);
  if (!quote.ok) return ok({ heading: "Quote of the day", quote: "No quote today.", author: quote.error.code });
  return ok({ heading: "Quote of the day", quote: quote.value.text, author: quote.value.author });
});
