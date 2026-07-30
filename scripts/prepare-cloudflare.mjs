import { execFileSync } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const apiToken = process.env.CLOUDFLARE_API_TOKEN

if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is not configured.")
if (!apiToken) throw new Error("CLOUDFLARE_API_TOKEN is not configured.")

const wranglerBin = path.join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler",
)
if (!existsSync(wranglerBin)) {
  throw new Error("Wrangler is not installed. Run npm install first.")
}

const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: apiToken }

function runWrangler(args, options = {}) {
  try {
    return execFileSync(wranglerBin, args, {
      cwd: root,
      env,
      encoding: "utf8",
      stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    const stderr = error?.stderr?.toString?.() ?? ""
    const stdout = error?.stdout?.toString?.() ?? ""
    throw new Error([`wrangler ${args.join(" ")} failed.`, stdout, stderr].filter(Boolean).join("\n"))
  }
}

function parseJsonArray(output) {
  const start = output.indexOf("[")
  const end = output.lastIndexOf("]")
  if (start < 0 || end < start) throw new Error("Unable to parse wrangler JSON output.")
  return JSON.parse(output.slice(start, end + 1))
}

const baseConfigPath = path.join(root, "wrangler.jsonc")
const baseConfig = JSON.parse(readFileSync(baseConfigPath, "utf8"))
const databaseName = baseConfig.d1_databases?.[0]?.database_name
if (!databaseName) throw new Error("wrangler.jsonc does not define a D1 database name.")

console.log(`Checking Cloudflare D1 database: ${databaseName}`)
let databases = parseJsonArray(runWrangler(["d1", "list", "--json"]))
let database = databases.find((item) => item.name === databaseName)

if (!database) {
  console.log("Database does not exist; creating it in the APAC location...")
  runWrangler(["d1", "create", databaseName, "--location", "apac"], { inherit: true })
  databases = parseJsonArray(runWrangler(["d1", "list", "--json"]))
  database = databases.find((item) => item.name === databaseName)
}

const databaseId = database?.uuid ?? database?.id
if (!databaseId) throw new Error(`Unable to resolve the database ID for ${databaseName}.`)

const generatedConfig = {
  ...baseConfig,
  account_id: accountId,
  d1_databases: baseConfig.d1_databases.map((binding) =>
    binding.database_name === databaseName
      ? { ...binding, database_id: databaseId }
      : binding,
  ),
}

const outputDir = path.join(root, ".wrangler")
mkdirSync(outputDir, { recursive: true })
const generatedConfigPath = path.join(outputDir, "wrangler.generated.jsonc")
writeFileSync(generatedConfigPath, `${JSON.stringify(generatedConfig, null, 2)}\n`)

console.log(`D1 database ready: ${databaseName} (${databaseId})`)
console.log(`Generated deployment config: ${path.relative(root, generatedConfigPath)}`)

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `database_id=${databaseId}\n`)
  appendFileSync(process.env.GITHUB_OUTPUT, `config_path=.wrangler/wrangler.generated.jsonc\n`)
}
