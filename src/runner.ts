/* eslint-disable no-console */

import { spawn } from 'child-process-promise'
import { promises as fs } from 'fs'

import { Config } from './config.schema.js'
import { createDirForTargetFile } from './fs.js'

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

  async run(
    command: Readonly<string>,
    args: ReadonlyArray<string>
  ): Promise<void> {
    const { appDatabaseUrl } = this

    // TODO: Create container if not exists.
    // TODO: Start container detached (i.e. in the background)
    try {
      await spawn(command, args, {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: appDatabaseUrl },
      })
    } catch (e) {
      // Silence exceptions.
    }
  }

  async getSchema(): Promise<string> {
    const { dockerImage, appDatabaseUrl } = this

    // TODO: Add option to exclude more schema.
    const { stdout } = await spawn(
      'docker',
      [
        'run',
        '--network',
        'host',
        '--rm',
        dockerImage,
        'pg_dump',
        '--no-sync',
        '--schema-only',
        '--no-owner',
        '--exclude-schema=graphile_migrate',
        appDatabaseUrl,
      ],
      { capture: ['stdout'] }
    )

    return stdout
  }

  async exportSchema(): Promise<void> {
    const schema = await this.getSchema()
    const target = 'dockjump/generated.sql'
    await createDirForTargetFile(target)
    await fs.writeFile(target, schema, { encoding: 'utf-8' })
  }
}
