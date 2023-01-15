/* eslint-disable no-console */

import { spawn } from 'child-process-promise'
import { promises as fs } from 'fs'

import { Config } from './config.schema.js'
import { createDirForTargetFile } from './fs.js'

const SCHEMA_EXPORT_PATH = 'dockjump/generated.sql'

function dispatchError(message: string): void {
  console.error(message)
  throw Error(message)
}

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

  async writeSchema(): Promise<void> {
    const schema = await this.getSchema()
    await createDirForTargetFile(SCHEMA_EXPORT_PATH)
    await fs.writeFile(SCHEMA_EXPORT_PATH, schema, { encoding: 'utf-8' })
  }

  async checkSchema(): Promise<void> {
    let exportedSchema
    try {
      exportedSchema = await fs.readFile(SCHEMA_EXPORT_PATH, {
        encoding: 'utf-8',
      })
    } catch (e) {
      if ((e as  NodeJS.ErrnoException).code === 'ENOENT') {
        dispatchError(`${SCHEMA_EXPORT_PATH} does not exist`)
      } else {
        throw e
      }
    }
    const schema = await this.getSchema()
    if (exportedSchema !== schema) {
      dispatchError(`${SCHEMA_EXPORT_PATH} is not up to date`)
    }
  }
}
