# Reactive first-sync readiness

Implements Master `messages/20261011T1400Z-master-rooms-wait-for-sync.md` using the existing host runtime. The installed declaration defines SyncStatus.lastCompleted as string | null; null is initial incomplete synchronization. No package or protocol is patched.

- Observe both Rooms and Sync Status continuously. Before first completed sync, show Loading without declaring a missing binding. Start typed reads only when the latest Room list has exactly one bound Room and lastCompleted is a string.
- Completed missing/multiple Room reach fails closed and clears when the original sole binding returns. Close stale query observers; late async setup/results cannot repopulate a lost reach.
- Preserve open edits through temporary reach loss; prevent new provider reads/writes while unavailable. Exact draft/write/save guards recheck availability at asynchronous boundaries and never discard already prepared House drafts. A different replacement locator does not silently move an existing editor to another Room.
- Existing refusal, write-halt, returned-draft and storage-loss warnings stay. No generic Room picker, permanent sync strip, guessed locator, content fallback, permission expansion, sandbox change, or new external resource.

Tests cover initial empty Room list with incomplete sync, both event orders, completed zero/multiple Rooms, delayed valid reach, temporary loss/recovery and unsaved-state preservation, plus rejected writes and stale observation cleanup. These are local checks, not hosted acceptance.

## Whole-workspace local-first architecture

All six donor modules are eagerly imported and mounted behind client-side hash navigation. The workspace observes every mounted Room document once after readiness; switching pages performs no fetch or query. Tasks retains its existing reactive local observation. Editable task/user/message/preference fields are staged as typed in actual business-document Room Drafts, including invalid text. Readiness, provider halt and lost-reach protections apply to every explicit Save/Send. UI appearance/display preferences use Runtime Presentation State and no extra schema. See README for the hosted acceptance boundary.


## Circle task UI

The task query also eagerly selects the model's existing Notes section. Detail routes use encoded document paths, not non-unique display IDs. The native draft editor is pinned to its opened Room/path; delayed writes and reads cannot update a new scope. Inline selectors and commands stage raw fields without saving. Explicit Save checks failed field writes and live reach after flushing, queues while the Provider is halted, and can retry a returned local refusal. The existing shell, other modules and binding readiness remain unchanged. Local React/HappyDOM tests are separate from the still-pending hosted/browser visual acceptance.

## Runtime JSON Pointer query repair

Master 1742 reports the live Runtime changed in source commit 8c14b5eb8 and rejects old bare select fields. Tasks' eager typed observation and guarded deletion snapshot now select `/id`, `/title`, `/status`, `/label`, `/priority`. Existing `fields: 'all'`, metadata `by: 'path'` and section name `Notes` remain literal. Field/section writes and model property names are not query pointers and are unchanged.

Official Runtime 0.1.0-c2647c1a232dd confirms selected pointers return original frontmatter structure, so `/title` still yields `fields.title`. The App's decoder is unchanged. Strict pointer validation and actual selected-field projection now run at the mock Runtime boundary in every mounted Tasks/workspace/Settings suite; the old shorthand is explicitly rejected. A separately pinned test-only current Runtime/mdmodel closure verifies native planning and projection. `reports/query-pointer-audit.json` records all four production query sites and source evidence.

Publishing this correction is provisional until its first page opens on dev without an error. A local test or successful release metadata check is not that first-page gate. The later tasks-a/tasks-b split remains a separate instruction and has not been started by this repair.
