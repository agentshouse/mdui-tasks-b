# Master 12:25 donor chrome audit

Porting instruction `messages/20261011T1225Z-master-crm-room-label.md`, 2026-10-11. Pinned donor `satnaing/shadcn-admin` at `e16c87f` has no ambient storage synchronization or Room selector in `src/features/tasks/index.tsx`. The Tasks port already requires exactly one runtime Room and never showed its name. Removed its added always-visible sync text; returned-change attention and write-halt warnings remain. Save feedback now truthfully says queued, not saved in House.

No manifest/schema/provider-storage changes. No Room ID/handle special-casing, fallback records, copy or rebinding. Local typecheck, lint, complete boundary tests and SSR pagination tests, build and release:check pass. Added source regression verifies no ambient sync strings and preserved warnings/queued feedback. Browser acceptance remains separate.
