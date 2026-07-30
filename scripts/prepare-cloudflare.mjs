import { execFileSync } from "node:child_process"
import { appendFileSync, readFileSync, rmSync, writeFileSync } from "node:fs"

const DATABASE_NAME = "write-skill-db"
const WRANGLER_CONFIG = "wrangler.jsonc"
const PROVISION_CONFIG = ".wrangler-provision.jsonc"

const requireEnvironment = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

requireEnvironment("CLOUDFLARE_API_TOKEN")
requireEnvironment("CLOUDFLARE_ACCOUNT_ID")

const runWrangler = (args, { inherit = false } = {}) =>
  execFileSync("npx", ["--yes", "wrangler@4", ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "true",
    },
    stdio: inherit ? "inherit" : ["ignore", "pipe", "inherit"],
  })

const readDatabases = () => {
  const output = runWrangler(["d1", "list", "--json", "--config", PROVISION_CONFIG])
  const parsed = JSON.parse(output)
  if (!Array.isArray(parsed)) throw new Error("Wrangler returned an unexpected D1 list response.")
  return parsed
}

const getDatabaseId = (database) =>
  database.uuid ?? database.id ?? database.database_id ?? database.databaseId

writeFileSync(
  PROVISION_CONFIG,
  `${JSON.stringify(
    {
      name: "write-skill-provision",
      compatibility_date: "2026-07-30",
    },
    null,
    2,
  )}\n`,
)

try {
  let database = readDatabases().find((item) => item.name === DATABASE_NAME)

  if (!database) {
    console.log(`Creating D1 database ${DATABASE_NAME} in APAC...`)
    runWrangler(
      ["d1", "create", DATABASE_NAME, "--location", "apac", "--config", PROVISION_CONFIG],
      { inherit: true },
    )
    database = readDatabases().find((item) => item.name === DATABASE_NAME)
  }

  const databaseId = database && getDatabaseId(database)
  if (!databaseId || typeof databaseId !== "string") {
    throw new Error(`Unable to resolve the database id for ${DATABASE_NAME}.`)
  }

  const config = readFileSync(WRANGLER_CONFIG, "utf8")
  const updatedConfig = config.replace(
    /("database_name"\s*:\s*"write-skill-db"[\s\S]*?"database_id"\s*:\s*)"[^"]+"/u,
    `$1"${databaseId}"`,
  )

  if (updatedConfig === config && !config.includes(databaseId)) {
    throw new Error(`Could not update database_id in ${WRANGLER_CONFIG}.`)
  }

  writeFileSync(WRANGLER_CONFIG, updatedConfig)
  console.log(`Using D1 database ${DATABASE_NAME} (${databaseId}).`)

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `database-id=${databaseId}\n`)
    appendFileSync(process.env.GITHUB_OUTPUT, `database-name=${DATABASE_NAME}\n`)
  }
} finally {
  rmSync(PROVISION_CONFIG, { force: true })
}
