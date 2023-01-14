/* eslint-disable no-console */

import { Config } from './config.schema.js'

const DOCKJUMP_APP_USERNAME = 'dockjump_appuser'
const DOCKJUMP_APP_PASSWORD = 'foobar'

export class Runner {
  readonly config: Required<Config>
  readonly basedir: string

  constructor(
    config: Required<Config>,
    { basedir }: { basedir?: string } = {}
  ) {
    this.config = config
    this.basedir = basedir ?? process.cwd()
  }

  get appDatabaseUrl(): string {
    const {
      development: { port, databaseName },
    } = this.config
    return `postgres://${DOCKJUMP_APP_USERNAME}:${DOCKJUMP_APP_PASSWORD}@localhost:${port}/${databaseName}`
  }

  printDatabaseUrl(): void {
    console.log(this.appDatabaseUrl)
  }
}
