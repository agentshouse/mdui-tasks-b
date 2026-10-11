import assert from 'node:assert/strict'
import { held, underneath } from '../node_modules/@agentshouse/app-bridge/node_modules/@agentshouse/mdruntime/dist/room-draft.js'
// Exercise the installed native implementation, not the React mock host.
const original = 'Original Notes\nwith another line.'
const draft = held(undefined, { sections: { Notes: { value: 'Raw unfinished <script> text', base: original } }, fields: { title: { value: '', base: { value: 'Original title' } } } })
assert.equal(draft.sections.Notes.base, original)
const changed = held(draft, { ...draft, sections: { ...draft.sections, Notes: { value: 'Later local text', base: 'Newer unseen confirmed Notes' } } })
assert.equal(changed.sections.Notes.base, original, 'Native Runtime retains the first section base')
assert.equal(changed.fields.title.value, '', 'Invalid raw title remains in its native draft')
const path='tasks/example.md'
const visible = { documents: { [path]: 'Markdown held by native test' }, collection: { documents: { [path]: { fields: { title: 'Original title' }, sections: { Notes: original } } } } }
assert.deepEqual(underneath(changed, path, visible), {})
visible.collection.documents[path].sections.Notes = 'Newer unseen confirmed Notes'
assert.deepEqual(underneath(changed, path, visible), { sections: { Notes: 'Newer unseen confirmed Notes' } }, 'Concurrent confirmed Notes change is detected against original display base')
console.log('PASS: installed native Room Draft section staging, first-base preservation, raw invalid fields and changed-underneath detection for existing Notes.')
