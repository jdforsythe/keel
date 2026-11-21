# Maintenance slot: add a field to an existing app (specified, not built)

A second brief kind for the head-to-head. The arm starts from a finished Recipe box (the first arm's own output, so both arms change their own app) and receives this brief in place of BRIEF.md. The harness runs the acceptance suite of the base brief first (the base score), then the change, then the suite again with the added checks below; the maintenance score is the added checks plus no regression of the base checks.

## Change

Add a `servings` field to a recipe: a whole number from 1 to 100, required, shown and edited everywhere the duration is.

- New-recipe form: number input `recipes.draft:servings` with a visible label and error element `recipes.draft:servings:error`, between minutes and price. An invalid value is refused like the other fields.
- List: text `recipes.servings.<id>` in each item. Recipe page: text `recipes.servings`. Catalog: text `recipes.table.servings.<id>` and a sort link `recipes.table.sort.servings`.
- Copy: `4 servings` and `1 serving` (en-US), `4 Portionen` and `1 Portion` (de-DE), `4 人分` and `1 人分` (ja-JP).
- Recipes already in the box when the app starts (there are none after a restart; the check creates its own) need no value; a recipe created without one is refused with the field's error.

## Scores added

Accepted: passed and total of the added checks (field, form refusal, copy in three locales, catalog sort, no base regression). Cost: tokens and wall time of the change, files touched (`git diff --stat` of the arm directory, counted by the runner). Not built: the added checks, the runner's `--maintenance` flag and the arm snapshot step.
