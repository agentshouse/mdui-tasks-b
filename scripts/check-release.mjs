import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
const files = []
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    assert(!entry.isSymbolicLink(), `Release must not contain symlink: ${filename}`)
    if (entry.isDirectory()) walk(filename)
    else { assert(entry.isFile(), `Not a regular file: ${filename}`); files.push(filename) }
  }
}
walk(dist)
const bytes = files.reduce((sum, filename) => sum + fs.statSync(filename).size, 0)
assert(files.length <= 2000, `Release has ${files.length} files, limit 2000`)
assert(bytes <= 20 * 1024 * 1024, `Release has ${bytes} bytes, limit 20 MiB`)
for (const name of ['app.json', 'schema.yaml']) {
  assert.equal(fs.readFileSync(path.join(root, name), 'utf8'), fs.readFileSync(path.join(dist, name), 'utf8'), `${name} differs from source`)
}
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'app.json'), 'utf8'))
const references = []
function localAsset(value, from) {
  if (value.startsWith('data:') || value.startsWith('#')) return
  assert(!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value), `External asset ${value} in ${from}`)
  const clean = decodeURIComponent(value.split(/[?#]/)[0])
  const target = clean.startsWith('/') ? path.resolve(dist, '.' + clean) : path.resolve(path.dirname(from), clean)
  assert(target.startsWith(dist + path.sep), `Asset escapes release: ${value}`)
  assert(fs.existsSync(target) && fs.statSync(target).isFile(), `Missing asset ${value} in ${from}`)
  references.push(path.relative(dist, target))
}
assert(typeof manifest.entry === 'string', 'Manifest entry missing')
localAsset(manifest.entry, path.join(dist, 'app.json'))
for (const filename of files) {
  if (filename.endsWith('.html')) {
    const html = fs.readFileSync(filename, 'utf8')
    for (const tag of html.matchAll(/<(?:script|link|img|source|video|audio|iframe)\b[^>]*>/gi)) {
      for (const match of tag[0].matchAll(/\b(?:src|href|poster)\s*=\s*['"]([^'"]+)['"]/gi)) localAsset(match[1], filename)
    }
  }
  if (filename.endsWith('.css')) {
    const css = fs.readFileSync(filename, 'utf8')
    for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/gi)) localAsset(match[1], filename)
    for (const match of css.matchAll(/@import\s+['"]([^'"]+)['"]/gi)) localAsset(match[1], filename)
  }
  if (filename.endsWith('.js')) {
    const js = fs.readFileSync(filename, 'utf8')
    for (const match of js.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) localAsset(match[1], filename)
  }
}
for (const name of ['LICENSE.txt', 'Circle-LICENSE.txt', 'THIRD_PARTY_NOTICES.txt', 'fonts/Inter-OFL.txt']) assert(fs.existsSync(path.join(dist, name)), `Missing notice: ${name}`)
const circleLicense = fs.readFileSync(path.join(root, 'licenses/Circle-MIT.md'), 'utf8')
assert.equal(fs.readFileSync(path.join(dist, 'Circle-LICENSE.txt'), 'utf8'), circleLicense)
assert(fs.readFileSync(path.join(dist, 'THIRD_PARTY_NOTICES.txt'), 'utf8').includes(circleLicense), 'Circle full MIT notice missing')
const circleRoot = path.join(root, 'src/features/tasks/circle')
for (const file of fs.readdirSync(circleRoot)) {
  const source = fs.readFileSync(path.join(circleRoot, file), 'utf8').replaceAll('http://www.w3.org/2000/svg', '')
  assert(!/localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|WebSocket|window\.open|next\/|zustand|motion\/|react-dnd|https?:\/\//.test(source), `Forbidden Circle authority or dependency in ${file}`)
}
const javascript = files.filter(filename => filename.endsWith('.js'))
assert.equal(javascript.length, 1, 'All module code must be one eager local bundle')
const bundle = fs.readFileSync(javascript[0], 'utf8')
assert(!/\bimport\s*\(/.test(bundle), 'No lazy code may load during module navigation')
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/donor-workspace.json'), 'utf8'))
for (const record of fixture.filter(record => record.type === 'workspace-user')) assert(!bundle.includes(record.fields.email), 'Source-only donor user fixture leaked into runtime')
assert(!files.some(filename => filename.includes('donor-workspace') || filename.includes('donor-original')), 'Seed data must stay outside release')
console.log(JSON.stringify({ result: 'passed', files: files.length, bytes, mebibytes: Number((bytes / 1024 / 1024).toFixed(3)), limitFiles: 2000, limitBytes: 20 * 1024 * 1024, entry: manifest.entry, referencedAssets: [...new Set(references)].sort(), verification: 'Local release artifact only; not live publication or browser acceptance.' }, null, 2))
