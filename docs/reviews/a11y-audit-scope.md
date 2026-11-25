# Accessibility audit: scope and request for quote

We ask for a manual accessibility audit against WCAG 2.2 Level A and AA, with assistive technology, of what Keel produces. Keel is a TypeScript framework for web apps: its UI package (`@keel/ui`) gives every app its base elements, focus ring, colors and type, and its headless widget package (`@keel/std-headless`) gives menus, tabs, dialogs, listboxes, comboboxes and data tables. An app built with Keel inherits their accessibility, good or bad, so a failure the audit finds in a shared element is a failure in every app. Keel is pre-release and heads for a public 0.x preview; this audit and a penetration test (`docs/reviews/pen-test-scope.md`) gate that release.

The release gate is: the retest report lists no open WCAG 2.2 Level A or AA failure.

## What Keel already checks

`docs/A11Y-TARGET.md` states what the framework enforces before an auditor sees anything: labels required on base elements at the type level, keyboard and focus behavior in the headless widgets following the WAI-ARIA Authoring Practices 1.2 patterns, contrast computed from the app's color tokens in `keel check` and at render, a focus ring no app style can remove, axe-core's WCAG 2.2 A and AA rules run in every rendered test, and a check that a status region announces. These cover what a machine can see. We want a person to judge what it cannot: whether a screen reader user can complete each task, whether names and announcements make sense in context, whether reading and focus order match the visual order, and whether content reflows and stays usable when magnified. Status messages (4.1.3) are a person's check by our own statement.

## In scope

### 1. The reference app

The reference app is `apps/golden-3`. It does not exist yet: an agent builds it from Keel's public documentation in a later run, and we add it to the engagement when it is deployed. Until then, two existing apps stand in for it, deployed on staging, and the audit runs against them if it starts first:

- `apps/household`, a shopping list and receipts book for the members of one home, rendered on the server. Pages: start (`/`), sign up (`/signup`), sign in (`/signin`), profile and API tokens (`/profile`), household setup (`/setup`), the shopping list (`/list`) and the receipts book (`/<locale>/receipts`).
- `apps/golden-2`, a recipe box in `en-US`, `de-DE` and `ja-JP`, routed in the browser. Pages: the recipe list (`/<locale>`), one recipe (`/<locale>/recipes/<id>`), the new-recipe form (`/<locale>/recipes/new`), sign up and sign in, and the catalog (`/<locale>/catalog`). The catalog holds every widget Keel ships: a combobox, a listbox in a disclosure, tabs, a data table with sorting, search, paging, a row menu and row selection, a dialog and toast messages.

We ask that the catalog page be tested in all three locales, and every other page in `en-US`.

### 2. The output of `keel scaffold`

A new project written by `keel scaffold project <name>` with one module, one route and one form, as a person following the getting-started guide would make it. The question is whether a new app starts accessible. We provide the generated project on staging.

### 3. The docs site

The site is not built yet. It is built with Keel and is added to the engagement when it exists, on the same staging host. We send its list of page templates when it is ready, so the quote can price it as an addition.

### Components

Where a failure comes from a shared element (a `@keel/ui` base element, the brand tokens, a `@keel/std-headless` widget) rather than from app code, we ask the report to say so. Source access is provided so the auditor can trace it.

## Out of scope

- **Native shells.** Capacitor and Tauri builds of the apps. No native build has run on a device; the web pages inside them are the same pages audited here.
- **The inspector and dev tools.** They run only in development and are not shipped to an app's users.
- **WCAG Level AAA**, beyond noting any failure the auditor sees in passing. Keel meets 2.4.13 Focus Appearance by design, and we welcome a check of it.
- **Content an app's author writes** (copy quality, image choice), except where Keel's elements make it impossible to do right.
- **Third-party sign-in pages.** The sign-in library in the stand-in apps renders no page; the pages are Keel's.

## Standard and method

- **Standard.** WCAG 2.2 Level A and AA, all criteria.
- **Method.** Manual expert testing of every page in scope, keyboard only and with each pairing below, plus the auditor's own automated scan. Testing by people with disabilities who use assistive technology daily is welcome, and we ask the quote to say whether it is included.
- **Assistive technology and browsers**, current versions at the time of testing:
  - NVDA with Firefox and with Chrome on Windows
  - JAWS with Chrome on Windows
  - VoiceOver with Safari on macOS
  - VoiceOver with Safari on iOS
  - TalkBack with Chrome on Android
  - Zoom to 200% and reflow at 320 CSS pixels wide (1.4.4, 1.4.10), text spacing (1.4.12), and Windows forced colors mode
  - Voice Control on macOS or iOS, or Dragon on Windows, for 2.5.3 Label in Name, if the firm offers it
- **Sample.** Every page listed above, in the states a person meets: empty, filled, with a validation error, after a submit, with a dialog open, with a toast shown, signed in and signed out.

## Deliverable

A written report. For each finding: the WCAG 2.2 success criterion it fails, its severity on the firm's scale (stated in the report), the page and state, the assistive technology and browser it was found with, the steps to reproduce, and a suggested fix where the firm has one. A per-criterion summary for each app: pass, fail or not applicable. One retest of every finding after we fix it, with an updated report, is part of the engagement. If the firm writes an Accessibility Conformance Report (VPAT, WCAG edition) from the retest, we ask for its price as an option.

## How findings are handled

Each finding becomes one tracked line in the project's backlog the day the report arrives, with the criterion and the report's reference. A finding in a shared element is fixed in the framework, which fixes every app; a finding in app code is fixed in the app and, where a check could have caught it, a check is added. Every Level A and AA finding is fixed before release and goes back to the firm for the retest. We publish the retest report, or a summary the firm approves, with the 0.x release.

## What the firm gets from us

- The staging addresses of each app and of the scaffold output, and a test account for each app with seeded data.
- Read access to the repository at a commit named at kickoff.
- The evidence bundle `keel evidence` writes for each app: a signed directory holding, per page route and WCAG criterion, what Keel's automated checks found, the criteria no automated rule maps to, and the contrast table of the app's color tokens.
- `docs/A11Y-TARGET.md`, `docs/BRAND.md` (the colors, type and focus ring) and this document.
- One technical contact who answers questions during the audit, named in the engagement letter.

## What we need in the quote

Effort in person-days and the price, the earliest start date, the length of the testing window, the retest terms and how long they stay open, the assistive technology and browser pairings the firm will use, whether testers with disabilities take part, whether the report may be published, and the firm's experience auditing design systems or component libraries.

subject: docs/A11Y-TARGET.md docs/BRAND.md spec/kernel/k.a11y.md spec/kernel/k.a11y-static.md spec/kernel/k.evidence.md apps/household apps/golden-2
verified: 5132ef10
