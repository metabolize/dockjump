import Ajv from 'ajv'
import { cosmiconfig } from 'cosmiconfig'

import { Config } from './config.schema'
import jsonSchema from './generated/config.schema.json'

const ajv = new Ajv({ removeAdditional: true }).addSchema(jsonSchema)
const explorer = cosmiconfig('dockjump', { searchPlaces: ['package.json'] })

export async function load(): Promise<Config> {
  const result = await explorer.search()
  if (!result) {
    throw Error('Config not found')
  } else if (!ajv.validate('#/definitions/Config', result.config)) {
    throw Error(ajv.errorsText(ajv.errors))
  } else {
    return result.config
  }
}
