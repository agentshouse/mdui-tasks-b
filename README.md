# Tasks

A Room-backed workspace for tasks, conversations, people, dashboards and preferences.

## Build and test

Use Node.js 24.21 or newer. Run `npm ci`, then `npm run verify`.
For development, run `npm run dev`.

## Publish

Configure `origin` as your authenticated House App Git remote. Commit your changes,
then run `npm run publish`. This checks the clean source tree, runs the full release
gates, and atomically publishes current source to `main` and built assets to
`release`. Authentication comes from your Git configuration.

## Starter documents

`starter/` contains a small selection of the existing demonstration documents,
at their original Room-relative paths. They validate against `schema.yaml`.
Copy them only into a new Room; publishing does not change Room data.
The application reads records from its writable `tasks` Room slot.

License notices are in `LICENSE`, `licenses/`, and the bundled third-party notices.
