// Publish guard. Exactly one package leaves this repo, it never depends on the private workspace
// packages, and its tarball contains every export target and no leftover internal import.
import { Glob } from 'bun'

const ROOT = `${import.meta.dir}/..`
const PUBLISHED_NAME = '@lst97-oss/last-notifications-widgets'
const INTERNAL = '@last-notifications-widgets/'

type Manifest = {
  name: string
  private?: boolean
  exports?: Record<string, unknown>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const manifests = await Promise.all(
  [...new Glob('packages/*/package.json').scanSync({ cwd: ROOT })].sort().map(async (path) => ({
    path,
    manifest: (await Bun.file(`${ROOT}/${path}`).json()) as Manifest,
  })),
)

const problems: string[] = []
const published = manifests.filter(({ manifest }) => !manifest.private)

if (published.length !== 1 || published[0].manifest.name !== PUBLISHED_NAME) {
  problems.push(`expected ${PUBLISHED_NAME} to be the only published package`)
}

for (const { manifest } of manifests) {
  if (!manifest.private) continue
  for (const [dep, range] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
    if (dep.startsWith(INTERNAL) && range !== 'workspace:*') {
      problems.push(`${manifest.name} depends on ${dep}@${range}; internal packages must use workspace:*`)
    }
  }
}

for (const { manifest } of published) {
  for (const [dep, range] of Object.entries({ ...manifest.dependencies, ...manifest.peerDependencies })) {
    if (dep.startsWith(INTERNAL)) problems.push(`${manifest.name} depends on ${dep}@${range}, which is not published`)
  }
}

const pkgDir = `${ROOT}/packages/last-notifications-widgets`
const packed = Bun.spawn(['npm', 'pack', '--dry-run', '--json'], { cwd: pkgDir, stdout: 'pipe', stderr: 'pipe' })
const packOutput = await new Response(packed.stdout).text()
if ((await packed.exited) !== 0) {
  console.error(await new Response(packed.stderr).text())
  process.exit(1)
}
const [pack] = JSON.parse(packOutput) as { files: { path: string }[] }[]
const tarball = new Set((pack?.files ?? []).map((file) => file.path))

const targets = Object.values(published[0].manifest.exports ?? {}).flatMap((entry) =>
  typeof entry === 'string' ? [entry] : Object.values(entry as Record<string, string>),
)
for (const target of targets) {
  const path = target.replace(/^\.\//, '')
  if (!tarball.has(path)) problems.push(`export target ${path} is missing from the tarball (run the build first)`)
}

for (const path of tarball) {
  if (!/\.(js|d\.ts)$/.test(path)) continue
  if ((await Bun.file(`${pkgDir}/${path}`).text()).includes(INTERNAL)) {
    problems.push(`${path} still imports a private ${INTERNAL} package`)
  }
}

// The browser entries must never carry the server SDK: its app key must not be reachable from a page.
const FRONT_ENDS = ['react', 'vue', 'vanilla', 'angular']
const BROWSER_ENTRY = new RegExp(`^dist/((${FRONT_ENDS.join('|')})/|client/(index\\.js|chunk-))`)
for (const path of tarball) {
  if (!BROWSER_ENTRY.test(path)) continue
  if ((await Bun.file(`${pkgDir}/${path}`).text()).includes('createNotificationsClient')) {
    problems.push(`${path} carries the server SDK; browser entries must not import ./server`)
  }
}

// Each front-end bundle imports outside libraries at runtime. Each one must be declared, or installs break for users.
const IMPORT = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g
const declared = { ...published[0].manifest.dependencies, ...published[0].manifest.peerDependencies }
for (const path of tarball) {
  if (!new RegExp(`^dist/(${FRONT_ENDS.join('|')})/.*\\.(js|mjs)$`).test(path)) continue
  const source = await Bun.file(`${pkgDir}/${path}`).text()
  for (const [, spec] of source.matchAll(IMPORT)) {
    if (spec.startsWith('.')) continue
    const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
    if (!Object.hasOwn(declared, name))
      problems.push(`${path} imports ${name}, which the published package does not declare`)
  }
}

if (problems.length > 0) {
  console.error('package check failed:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(`${PUBLISHED_NAME} is the only published package; ${targets.length} export targets in the tarball`)
