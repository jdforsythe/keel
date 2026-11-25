# Evenly

A group trip's shared costs: who paid, who owes, and who pays whom. Evenly is Keel's walkthrough app, built one layer at a time. It runs in the browser alone, with no server, no sign-in and no user concept; each layer adds one thing a real group asks for.

Check your work, in this folder:

```sh
node ../../packages/cli/src/bin.ts check
node ../../packages/cli/src/bin.ts test
node ../../packages/cli/src/bin.ts build
```

## Layers

1. A page with no server. `modules/app/StartPage.tsx` is the start page, `dist/web` is plain files served with `csp.txt`. One minute: put a second export beside the page and read E1752.
2. A trip in a store. The `trip` module holds people and costs in one store, `trip.trip`, changed only by the transactions `trip.addPerson` and `trip.addCost`; `/trip` shows a Costs tab and a Balances tab (`Tabs`), and adding a person opens a `Dialog`. A cost splits equally and to the cent (`splitEqually`), and balances are read from the costs, never stored. `prove` shows both transactions keep four invariants (ids unique, every payer and every share belongs to someone on the trip) for every state the schemas allow. It cannot state "balances sum to zero" over an array, since the proof fragment has no sum; `test/trip.balances.test.ts` checks that for 200 seeded trips and `test/trip.model.test.ts` for every explored state. One minute: write `Date.now()` in `CostsPanel.tsx` and read E1601.
3. The cost form. `CostForm` is a `form` over `CostDraft`: a title (`line` from `@keel/std-text`), an amount typed as text, a currency, who paid and each person's parts. The route's `POST` action `saveCost` reads the amount with `parseMoney` (`@keel/std-money`), so `12.505` euros is refused with a message on the amount field and never rounded; `splitByParts` divides the cost in proportion to the parts and the shares add up to the cost to the cent (`test/trip.split.test.ts`, 500 seeded runs, and 10.00 split three ways is 3.34, 3.33 and 3.33). A trip keeps its costs in one currency. One minute: call `parseMoney` in `saveCost.server.ts` and drop its result, and read E1453.
