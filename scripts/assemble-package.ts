// Assembles the one published package (@lst97-oss/last-notifications-widgets) from the workspace builds.
// Each front-end bundle imports the private client by name; here that import is rewritten to the copy shipped beside
// it, so consumers install this package and nothing else. Run after the workspace builds.

import { dirname, relative } from 'node:path'
import { Glob } from 'bun'

const ROOT = `${import.meta.dir}/..`
const PKG = `${ROOT}/packages/last-notifications-widgets`
const OUT = `${PKG}/dist`
const CLIENT_SPECIFIER = '@last-notifications-widgets/client'
// Every front-end this package ships, with the entry files it must produce. Each becomes dist/<name>/ with its own
// stylesheet. Angular's entries are its ng-packagr output, not an index.
const ENTRIES: Record<string, string[]> = {
  react: ['index.js', 'index.d.ts'],
  vue: ['index.js', 'index.d.ts'],
  vanilla: ['index.js', 'index.d.ts'],
  angular: ['fesm2022/last-notifications-widgets-angular.mjs', 'types/last-notifications-widgets-angular.d.ts'],
}
const ADAPTERS = Object.keys(ENTRIES)

await Bun.$`rm -rf ${OUT}`

for (const name of ['client', ...ADAPTERS]) {
  for (const rel of new Glob('**/*').scanSync({ cwd: `${ROOT}/packages/${name}/dist`, onlyFiles: true })) {
    // ng-packagr writes its own package.json into dist; the umbrella package has its own manifest.
    if (rel.endsWith('.map') || rel === 'package.json') continue
    await Bun.write(`${OUT}/${name}/${rel}`, Bun.file(`${ROOT}/packages/${name}/dist/${rel}`))
  }
}

// The React sheet also keeps its root path, so 0.1.0 consumers' `styles.css` import still resolves.
await Bun.write(`${OUT}/styles.css`, Bun.file(`${ROOT}/packages/react/dist/styles.css`))

let rewired = 0
for (const name of ADAPTERS) {
  for (const rel of new Glob('**/*.{js,mjs,d.ts}').scanSync({ cwd: `${OUT}/${name}`, onlyFiles: true })) {
    const path = `${OUT}/${name}/${rel}`
    const source = await Bun.file(path).text()
    if (!source.includes(CLIENT_SPECIFIER)) continue
    // Relative to the file's own folder, so nested output points back up to the client correctly.
    const target = relative(dirname(path), `${OUT}/client/index.js`).replaceAll('\\', '/')
    await Bun.write(
      path,
      source.replaceAll(`"${CLIENT_SPECIFIER}"`, `"${target}"`).replaceAll(`'${CLIENT_SPECIFIER}'`, `'${target}'`),
    )
    rewired += 1
  }
}

// npm ships README and LICENSE only from the package root, so copy them there (gitignored).
for (const file of ['README.md', 'LICENSE']) await Bun.write(`${PKG}/${file}`, Bun.file(`${ROOT}/${file}`))

const required = [
  'client/index.js',
  'client/index.d.ts',
  ...ADAPTERS.flatMap((name) => [...ENTRIES[name].map((entry) => `${name}/${entry}`), `${name}/styles.css`]),
  'styles.css',
]
const missing = required.filter((entry) => !Bun.file(`${OUT}/${entry}`).size)
if (missing.length > 0) {
  console.error(`assemble failed, missing: ${missing.join(', ')}`)
  process.exit(1)
}

console.log(`assembled ${OUT}: client, ${ADAPTERS.join(', ')}; ${rewired} files rewired to the local client`)
