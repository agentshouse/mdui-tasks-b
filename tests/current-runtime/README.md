# Native MD Runtime JSON Pointer regression

This isolated **test-only** dependency closure uses official npm packages:

- `@agentshouse/mdruntime` `0.1.0-c2647c1a232dd`
- `@agentshouse/mdmodel` `0.1.0-c0bdbbc92d020` (Runtime's exact dependency)

The complete transitive resolution and SHA-512 integrity values are retained in
`package-lock.json`. No application package files were modified by this setup.
No dependency lifecycle scripts were run.

## Reproduce

```sh
npm ci --prefix /path/to/pointer-contract --ignore-scripts --no-audit --no-fund
node /path/to/pointer-contract/test-tasks-native.mjs /path/to/ports/tasks
```

If the helper and test are copied into an App's test directory, retain this
manifest and lockfile there, or set `MD_QUERY_CONTRACT_ROOT` to an already
installed copy of this isolated closure. The helper checks exact runtime and
model versions before use.

`test-tasks-native.mjs` reads the current Tasks source files and extracts all
four actual query/observe call arguments plus `tasksQuery` using TypeScript's
AST. It evaluates only the object expressions; it does not boot the App.
The queries run through the official Runtime's `planOf`, with types returned
by the official model's `verify` for the actual `schema.yaml`. Native
`createReadSide` plus `rowsOf` verifies the projected result and delete
payload, rather than imitating the SDK's field projection.

Coverage includes all five production expressions, rejection of the old bare
field selects, bare where/order/group names, unknown typed fields, invalid
pointer escaping, original-key projection, Notes section selection, all-fields
sentinel, path metadata ordering, change metadata, and current Markdown for
task deletion. This is local SDK regression coverage, not a live-host or
browser acceptance test.

The SDK declares Node >=24.21.0. This diagnostic ran successfully on the
available Node 24.19.0, which produced a non-fatal engine warning at install.
Use the declared supported Node version for an environment without that caveat.

## Reusable native helper

`factsFromSchemaFile(schemaPath, room)` returns fully available typed facts:
`{ listed: true, rooms: [{ locator: room, available: true, types: definitions }] }`.
`assertNativeQuery(query, facts)` executes the official validator.
`nativeDocumentQuery(query, facts, [{room,path,markdown}])` executes the official
in-memory read side. It does not connect to House or change remote state.

## Source evidence

Within installed `@agentshouse/mdruntime`:

- `AGENTS.md:82–118`: JSON Pointer query contract, metadata names and nested projection.
- `dist/query.js:114–118`: pointer syntax and escape validation.
- `dist/query.js:149–157`: typed model field checks.
- `dist/query.js:307–316`: literal metadata keys and field sort/group validation.
- `dist/query.js:364–376`: all sentinel and section-name distinction.
- `dist/read-side.js:182–244`: original-key/nested pointer projection.

Registry source:
https://registry.npmjs.org/@agentshouse/mdruntime/-/mdruntime-0.1.0-c2647c1a232dd.tgz

The reported host source commit `8c14b5eb8` is not an npm package version;
this pinned published package independently implements the announced contract.
