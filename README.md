# Tasks — full House workspace demo

A single-page workspace retaining the broad shell/modules from [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin), pinned donor commit `e16c87f213a5ba5e45964e9b67c792105ec74d26`.

The Tasks experience now extracts source components from [ln-dev7/circle](https://github.com/ln-dev7/circle/tree/b0ba7ddcc3d0f4c16092236ca6a01b56c0614810), pinned at `b0ba7ddcc3d0f4c16092236ca6a01b56c0614810`. This is a bounded task UI extraction, not a port of the entire Circle application.

## Modules

- Dashboard: donor overview, recent sales, analytics, referrers and devices; local JSON download
- Tasks: Circle compact grouped issue list, full title/description detail, inline status/priority controls, label control, contextual command menu and local search/filter/display options; the existing 100 donor tasks remain. The previous table, bulk tools and CSV import/export remain available under Display → Table tools.
- Chats: the donor’s ten conversations and 43 message documents; Send saves a new message to the Room, visible to its members
- Users: all 500 seeded donor users, filters/sorting/pagination, real demo-record creation/edit/deletion and status actions
- Apps: all 15 donor integration cards and original sample connection states, with local search/filter/sort
- Settings: all five donor sections; profile/account/notification preferences are business documents, appearance/display are Runtime Presentation State

All six module trees are eagerly imported and remain mounted. Hash navigation and Back/Forward switch locally, without a document reload, page fetch, code split or new query. One eager observation reads all mounted Room documents after the existing reactive first-sync readiness gate. No demo fixture is imported into the runtime bundle and no business content is cached in browser storage.

## Business data and drafts

The existing App is `a_e.n` at https://dev.agents.house/app/a_e.n and the existing Room is `tasks-pilot` (`r_15.v`). The single writable `tasks` slot now covers nine types: task, workspace-user, conversation, chat-message, integration, dashboard, profile, account and notification-preferences. There is no second App, Room, task collection or UI-buffer schema.

The complete seeded Room has 672 business documents: the previous 100 task documents plus 572 additive donor documents. Source-only fixture provenance and original chat data are in `fixtures/`. Guarded create-only payloads are in `reports/whole-demo/`; they must never be blindly replayed after successful application. Preferences use `preferences/*.md`; House reserves `settings/` for its own settings, including `settings/schema.yaml`.

Every editable document field is staged into its actual durable Room Draft as typed, including invalid/incomplete values. Draft observation restores reloads and other tabs, later overlapping input is reapplied after stale, disjoint changes and Runtime-owned first bases remain. Explicit Save validates; explicit Chat Send saves the message document. Failed fields are visibly retained and block Save until retried. Changing editor scope cannot replay late acknowledgements or field bases into another document. Local Save remains available during provider upload halt, while lost Room reach blocks Save without discarding drafts.

## Circle task mapping

Circle retains its 44px task rows, 40px tinted group headers, SVG status/priority icons, label pills, searchable property popovers, large detail body/right property rail and contextual command composition. Next links become local hash navigation keyed by Room document path, preserving duplicate display IDs and browser Back/Forward. The property rail stacks on narrow screens. Existing locally bundled Inter and approved primitives replace remote Geist, Next, motion and DnD. No new dependency is installed.

The unchanged task model exposes title, five statuses, four priorities, one label and the Notes section. Circle’s Urgent priority glyph maps to existing Critical. Description edits Notes directly; unsupported assignee/project/cycle/due-date fields and simulated activity/sub-issues/PRs are not presented as working controls. The property rail explains the available boundary. No user identity, fixture, external asset or fake success action is imported from Circle.

Every inline property choice and command-menu change stages a real business draft. Save is explicit, including after inline edits. Raw title/Notes survive reload; failed field writes block Save; a refused Save can be explicitly retried without retyping. Error, returned-draft, underlying-change and provider-halt states remain visible. Plain text Notes are escaped, not interpreted as HTML.

## Honest boundaries

Users/profile/account/notification screens edit donor demo records, never actual House accounts, credentials, permissions or delivery settings. Connect, Invite, passwords, calls, external chat and attachment delivery have no implementation and are explained as unavailable. Donor sample integration states are labeled as demo states. No actual external account is connected or message/call/email operation performed by this port.

New Room messages use a neutral “Room member” sender until House exposes current-member identity. Available Provider head attribution is labeled “Last saved by”; it is not claimed as immutable original authorship. Existing donor message labels remain exact.

Per Master, missing/external avatar images use the donor initials fallback. No external portraits are fetched. All brand icons and the default Inter font are bundled. Manrope is labeled unavailable; donor file-sidebar display preferences are retained as UI preferences without inventing file destinations. Donor chart samples are captured once and rendered locally with SVG/CSS charts instead of introducing unavailable chart dependencies.

## Gates

Use the existing installed dependencies (or the pinned lockfile in an authorized environment):

    npm run lint
    npm test
    npm run build
    npm run release:check

Serialize heavy builds with the shared Porting build lock. Tests include original task/CSV/readiness/draft regressions; exact fixture/schema/MD Model round-trips; six real React module trees; zero navigation query growth; real chat drafting/Send/remount/other-tab behavior; Settings validation and Presentation state; delayed scope changes, failed-field protection and creation-to-saved transitions. The release check covers a closed local asset graph, eager code, source-only demo fixtures, notices and the 2,000-file/20 MiB limits.

Local checks and accepted publication do not establish hosted acceptance. The current browser authentication/installed-release activation blocker remains external; status stays working until the exact published bytes are tested in the hosted renderer. The known Node 24.19.0 versus package-declared >=24.21.0 advisory and non-failing >500 kB single-chunk advisory remain accurately disclosed.

## Notices

Both donor MIT notices are retained verbatim: satnaing in source LICENSE/`public/LICENSE.txt`, and Circle in `licenses/Circle-MIT.md`/`public/Circle-LICENSE.txt` and THIRD_PARTY_NOTICES. The existing locked production dependency/bridge MIT notices and bundled Inter OFL remain in the release. No dependency was added for these modules. See `SOURCE.md`.

## Current Runtime query contract

All frontmatter query selectors use JSON Pointers, while metadata, section headings, `all` and business draft keys keep their own forms. `reports/query-pointer-audit.json` lists every production query site. The normal test suite rejects old bare selectors and reproduces native selected-field projection rather than returning every field unconditionally.

For the independent current-SDK planning/projection gate, install the pinned test-only closure with `npm ci --prefix tests/current-runtime --ignore-scripts`, then run `npm run test:current-runtime`. An existing isolated closure can be selected with `MD_QUERY_CONTRACT_ROOT`. This does not upgrade the App's production bridge/runtime dependency graph. The first page still needs an actual dev opening after a provisional repair release before acceptance is claimed.
