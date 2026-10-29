// Assembles the one published package (@lst97-oss/last-notifications-widgets) from the workspace builds.
// The React bundle imports the private client by name; its compiled stylesheet ships as styles.css; here that import is rewritten to the copy
// shipped beside it, so consumers install this package and nothing else. Run after the workspace builds.
import { Glob } from 'bun'

const ROOT = `${import.meta.dir}/..`
const PKG = `${ROOT}/packages/last-notifications-widgets`
const OUT = `${PKG}/dist`
const CLIENT_SPECIFIER = '@last-notifications-widgets/client'

await Bun.$`rm -rf ${OUT}`

for (const name of ['client', 'react']) {
  for (const rel of new Glob('**/*').scanSync({ cwd: `${ROOT}/packages/${name}/dist`, onlyFiles: true })) {
    // styles.css is written once, at the root of dist, below.
    if (rel.endsWith('.map') || rel === 'styles.css') continue
    await Bun.write(`${OUT}/${name}/${rel}`, Bun.file(`${ROOT}/packages/${name}/dist/${rel}`))
  }
}

let rewired = 0
for (const rel of new Glob('**/*.{js,d.ts}').scanSync({ cwd: `${OUT}/react`, onlyFiles: true })) {
  const path = `${OUT}/react/${rel}`
  const source = await Bun.file(path).text()
  if (!source.includes(CLIENT_SPECIFIER)) continue
  const rewritten = source
    .replaceAll(`"${CLIENT_SPECIFIER}"`, '"../client/index.js"')
    .replaceAll(`'${CLIENT_SPECIFIER}'`, "'../client/index.js'")
  await Bun.write(path, rewritten)
  rewired += 1
}

await Bun.write(`${OUT}/styles.css`, Bun.file(`${ROOT}/packages/react/dist/styles.css`))

// npm ships README and LICENSE only from the package root, so copy them there (gitignored).
for (const file of ['README.md', 'LICENSE']) await Bun.write(`${PKG}/${file}`, Bun.file(`${ROOT}/${file}`))

const required = ['client/index.js', 'client/index.d.ts', 'react/index.js', 'react/index.d.ts', 'styles.css']
const missing = required.filter((entry) => !Bun.file(`${OUT}/${entry}`).size)
if (missing.length > 0) {
  console.error(`assemble failed, missing: ${missing.join(', ')}`)
  process.exit(1)
}

console.log(`assembled ${OUT}: client and react entries, ${rewired} react files rewired to the local client`)
