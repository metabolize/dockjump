import Ajv from 'ajv'
import { cosmiconfig } from 'cosmiconfig'
import fs from 'fs'
import lodash from 'lodash'
import path from 'path'
import { PartialDeep } from 'type-fest'
import { fileURLToPath } from 'url'

import { ConfigInput } from './config.schema.js'

const jsonSchema = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'generated',
      'config.schema.json'
    ),
    'utf-8'
  )
)
const ajv = new Ajv({ removeAdditional: true }).addSchema(jsonSchema)

// Adapted from https://stackoverflow.com/a/67833840/893113
export type RequiredDeep<T> = {
  [K in keyof T]: RequiredDeep<T[K]>
} & Required<T>

export type Config = RequiredDeep<ConfigInput> & {
  databaseUrlOverride?: string
}

export const DEFAULT_CONFIG: PartialDeep<Config> = {
  development: {
    port: 15432,
    username: 'dockjump_appuser',
    password: 'foobar',
  },
  postgresVersion: '13.2',
}

const explorer = cosmiconfig('dockjump', { searchPlaces: ['package.json'] })

export async function loadConfig(): Promise<RequiredDeep<Config>> {
  const loaded = await explorer.search()
  if (!loaded) {
    throw Error(
      'Configuration not found. Please add a `dockjump` section to package.json.'
    )
  } else if (!ajv.validate('#/definitions/ConfigInput', loaded.config)) {
    throw Error(ajv.errorsText(ajv.errors))
  }

  const validated = loaded.config as ConfigInput
  const dynamicDefaults: PartialDeep<Config> = {
    development: {
      containerName: `dockjump_${validated.development.databaseName}`,
    },
  }
  return lodash.defaultsDeep(
    {},
    { databaseUrlOverride: process.env.DATABASE_URL },
    validated,
    dynamicDefaults,
    DEFAULT_CONFIG
  )
}
