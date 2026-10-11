import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
const separator = '\n' + '='.repeat(80) + '\n'
const parts = [
  'THIRD-PARTY NOTICES\n\nTasks includes software from the packages listed below. This notices file\ncontains license and notice files distributed with the installed production\ndependency closure, a superset of the packages bundled into the web app.\n\nPackage license identifiers are reported as published, without inferring\nrights that a package does not grant. Dependency versions are from package-lock.json.\n',
  separator + 'Donor: satnaing/shadcn-admin\nCommit: e16c87f213a5ba5e45964e9b67c792105ec74d26\n\n' + fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
]
parts.push(separator + 'Task UI donor: ln-dev7/circle\nCommit: b0ba7ddcc3d0f4c16092236ca6a01b56c0614810\nAdapted list/detail/property/command components; existing Room data retained.\n\n' + fs.readFileSync(path.join(root, 'licenses/Circle-MIT.md'), 'utf8'))
const missing = []
let count = 0
for (const [relative, entry] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!relative || entry.dev) continue
  const directory = path.join(root, relative)
  const manifest = path.join(directory, 'package.json')
  if (!fs.existsSync(manifest)) continue // Optional platform package is not installed or bundled.
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  const files = fs.readdirSync(directory).filter((file) =>
    /^(licen[cs]e|copying|copyright|notice)(?:[.\-_]|$)/i.test(file) && fs.statSync(path.join(directory, file)).isFile()
  ).sort()
  const identifier = typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? pkg.licenses ?? 'Not declared')
  parts.push(separator + `${pkg.name} ${pkg.version}\nLicense identifier: ${identifier}\n`)
  if (!files.length) {
    parts.push('\nNo license or notice file was distributed at the package root.\n')
    missing.push({ name: pkg.name, version: pkg.version, license: identifier })
  }
  for (const file of files) {
    parts.push(`\n--- ${file} ---\n\n` + fs.readFileSync(path.join(directory, file), 'utf8') + '\n')
  }
  count += 1
}
fs.writeFileSync(path.join(root, 'public/THIRD_PARTY_NOTICES.txt'), parts.join(''))
console.log(JSON.stringify({ packages: count, missingLicenseFiles: missing }, null, 2))
