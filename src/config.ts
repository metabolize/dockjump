import Ajv from 'ajv'
import { cosmiconfig } from 'cosmiconfig'
import fs from 'fs'
import lodash from 'lodash'
import path from 'path'
import { fileURLToPath } from 'url'

import { Config, DEFAULT_CONFIG } from './config.schema.js'

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
const explorer = cosmiconfig('dockjump', { searchPlaces: ['package.json'] })

export async function loadConfig(): Promise<Required<Config>> {
  const result = await explorer.search()
  if (!result) {
    throw Error(
      'Configuration not found. Please add a `dockjump` section to package.json.'
    )
  } else if (!ajv.validate('#/definitions/Config', result.config)) {
    throw Error(ajv.errorsText(ajv.errors))
  } else {
    return lodash.defaultsDeep({}, result.config, DEFAULT_CONFIG)
  }
}
