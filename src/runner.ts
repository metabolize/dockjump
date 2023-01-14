/* eslint-disable no-console */

import { spawn } from 'child-process-promise'

import { Config } from './config.schema.js'

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
      development: { port, databaseName, username, password },
    } = this.config
    return `postgres://${username}:${password}@localhost:${port}/${databaseName}`
  }

  printDatabaseUrl(): void {
    console.log(this.appDatabaseUrl)
  }

  get dockerImage(): string {
    const { postgresVersion } = this.config
    return `postgres:${postgresVersion}`
  }

  async runPsql(databaseUrl: string): Promise<void> {
    const { dockerImage } = this
    try {
      await spawn(
        'docker',
        [
          'run',
          '--interactive',
          '--tty',
          '--network',
          'host',
          '--rm',
          dockerImage,
          'psql',
          databaseUrl,
        ],
        { stdio: 'inherit' }
      )
    } catch (e) {
      // Silence exceptions, which tend to be verbose enough.
    }
  }
}
