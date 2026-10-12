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

## Portable publisher safety

The publisher accepts credential-free HTTPS House App remotes on any host, including
`https://<host>/app/new.git` for creation. Choose only a host and App you are authorized
to publish to. Host portability does not authorize publication to another environment.
For initial creation, use `npm run publish -- --name "<display name>"`; `--name` is
optional and no default display name is invented. The helper reports only complete,
explicitly returned App/Git receipt URLs and never changes `origin`. After creation,
inspect the returned canonical App in House and set its actual Git URL as `origin`
before another publication. Never retry an uncertain creation blindly.

`npm run test:publisher` runs offline local-Git regression fixtures with mocked
push/remote transport; it installs no packages and does not contact House. These
checks are included in `npm run verify` before the existing App-specific gates.
Publication requires clean committed `main`, runs exactly that full verify gate,
pins the source SHA, and atomically pushes source `main` plus a parentless dist-only
`release`. It preserves the normal index and source branch, rejects unsafe origin
rewrites, index flags, metadata mismatches, and conflicting publisher/worktree locks.
It never commits source, resets work, or substitutes a build-only verification.

Failure diagnostics suppress arbitrary subprocess output to avoid leaking credentials.
Run `npm run verify` locally for full compiler/test output; never share credential
values or verbose HTTP traces. A reported creation receipt or advertised source SHA
does not prove release admission: inspect the known App's published revision in House.
After a failed or uncertain push, inspect that state before deciding whether to retry.
