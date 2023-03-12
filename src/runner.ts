/* eslint-disable no-console */

import { spawn } from 'child-process-promise'
import { promises as fs, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import wait from 'wait-promise'

import { Config } from './config.js'
import { namedContainerExists } from './docker.js'
import { createDirForTargetFile } from './fs.js'

const SCHEMA_EXPORT_PATH = 'dockjump/generated.sql'

function dispatchError(message: string): void {
  console.error(message)
  throw Error(message)
}

export class Runner {
  readonly config: Config
  readonly basedir: string

  constructor(config: Config, { basedir }: { basedir?: string } = {}) {
    this.config = config
    this.basedir = basedir ?? process.cwd()
  }

  get appDatabaseUrl(): string {
    const {
      development: { port, databaseName, username, password },
    } = this.config
    return `postgres://${username}:${password}@localhost:${port}/${databaseName}`
  }

  private get gmrcConfig(): string {
    const { port, databaseName, username, password } = this.config.development
    return `module.exports = {
  rootConnectionString: 'postgres://postgres:postgres@localhost:${port}/postgres',
  connectionString: 'postgres://${username}:${password}@localhost:${port}/${databaseName}',
  shadowConnectionString: 'postgres://${username}:${password}@localhost:${port}/${databaseName}_shadow',
}
`
  }

  async init(): Promise<void> {
    if (existsSync('.gmrc.js')) {
      throw Error('.gmrc.js already exists')
    }

    await fs.writeFile('.gmrc.js', this.gmrcConfig, 'utf-8')
  }

  private async setUpDatabases(): Promise<void> {
    const { postgresDockerImage } = this
    const {
      development: { port, databaseName, username, password },
    } = this.config

    console.error('Setting up databases for graphile-migrate')

    // Set up databases for graphile-migrated.
    const script = await fs.readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'setup-databases.sh'
      ),
      'utf-8'
    )
    const promise = spawn(
      'docker',
      [
        'run',
        '--rm',
        '--interactive',
        '--network',
        'host',
        '--env',
        `PGPORT=${port}`,
        '--env',
        `APP_USERNAME=${username}`,
        '--env',
        `APP_PASSWORD=${password}`,
        '--env',
        `APP_DATABASE_NAME=${databaseName}`,
        postgresDockerImage,
        'bash',
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] }
    )

    const { stdin } = promise.childProcess

    if (!stdin) {
      throw Error('Expected stdin to be defined')
    }
    stdin.write(script)
    stdin.end()

    await promise
  }

  private async migrate(): Promise<void> {
    console.error('Running migrations')
    await spawn(
      './node_modules/.bin/graphile-migrate',
      ['migrate'],
      { stdio: ['ignore', 'inherit', 'inherit'] }
    )
  }

  async create(): Promise<void> {
    const { postgresDockerImage } = this
    const {
      development: { containerName, port },
    } = this.config

    if (await namedContainerExists(containerName)) {
      console.error(`Container ${containerName} already exists; nothing to do.`)
      return
    } else {
      await spawn(
        'docker',
        [
          'create',
          '--name',
          containerName,
          '--publish',
          `${port}:5432`,
          '--env',
          'POSTGRES_PASSWORD=postgres',
          postgresDockerImage,
        ],
        { stdio: ['ignore', 'ignore', 'inherit'] }
      )
      console.error(
        `Created container ${containerName} using ${postgresDockerImage}`
      )
    }

    // Spin up container.
    await this.start()
    console.error(`Started container ${containerName}`)

    try {
      // Give the Postgres server a chance to start.
      await wait.sleep(1e3)
      await this.setUpDatabases()
      await this.migrate()
    } finally {
      console.error(`Stopping container ${containerName}`)
      await this.stop()
    }

    console.error(`Container ${containerName} is ready to use`)
  }

  async start(): Promise<void> {
    const { containerName } = this.config.development
    await spawn('docker', ['start', containerName], {
      stdio: ['ignore', 'ignore', 'inherit'],
    })
  }

  private async stop(): Promise<void> {
    const { containerName } = this.config.development
    await spawn('docker', ['stop', containerName], {
      stdio: ['ignore', 'ignore', 'inherit'],
    })
  }

  async removeContainer(): Promise<void> {
    const { containerName } = this.config.development

    if (!(await namedContainerExists(containerName))) {
      console.error(`Container ${containerName} doesn't exist; nothing to do.`)
      return
    }

    await this.stop()
    await spawn('docker', ['rm', containerName], {
      stdio: ['ignore', 'ignore', 'inherit'],
    })
    console.error(`Removed container ${containerName}`)
  }

  printDatabaseUrl(): void {
    console.log(this.appDatabaseUrl)
  }

  get postgresDockerImage(): string {
    const { postgresVersion } = this.config
    return `postgres:${postgresVersion}`
  }

  async runPsql(databaseUrl: string): Promise<void> {
    const { postgresDockerImage } = this
    try {
      await spawn(
        'docker',
        [
          'run',
          '--rm',
          '--interactive',
          '--tty',
          '--network',
          'host',
          postgresDockerImage,
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
    const { postgresDockerImage, appDatabaseUrl } = this

    // TODO: Add option to exclude more schema.
    const { stdout } = await spawn(
      'docker',
      [
        'run',
        '--network',
        'host',
        '--rm',
        postgresDockerImage,
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
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
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
