import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
// Keep source manifests authoritative. Vite copies these local public files to dist.
for (const name of ['app.json', 'schema.yaml']) {
  fs.copyFileSync(path.join(root, name), path.join(root, 'public', name))
}
