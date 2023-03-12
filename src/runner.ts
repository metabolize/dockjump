/* eslint-disable no-console */

import { spawn } from 'child-process-promise'
import { existsSync, promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import wait from 'wait-promise'

import { Config } from './config.js'
import {
  namedContainerExists,
  removeContainer,
  stopContainer,
} from './docker.js'
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

  get postgresDockerImage(): string {
    const { postgresVersion } = this.config
    return `postgres:${postgresVersion}`
  }

  get appDatabaseUrl(): string {
    const {
      development: { port, databaseName, username, password },
    } = this.config
    return `postgres://${username}:${password}@localhost:${port}/${databaseName}`
  }

  performPrintDatabaseUrl(): void {
    console.log(this.appDatabaseUrl)
  }

  async performInit(): Promise<void> {
    if (existsSync('.gmrc.js')) {
      throw Error('.gmrc.js already exists')
    }

    const { port, databaseName, username, password } = this.config.development
    const gmrcConfig = `module.exports = {
  rootConnectionString: 'postgres://postgres:postgres@localhost:${port}/postgres',
  connectionString: 'postgres://${username}:${password}@localhost:${port}/${databaseName}',
  shadowConnectionString: 'postgres://${username}:${password}@localhost:${port}/${databaseName}_shadow',
}
`

    await fs.writeFile('.gmrc.js', gmrcConfig, 'utf-8')
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
    await spawn('./node_modules/.bin/graphile-migrate', ['migrate'], {
      stdio: ['ignore', 'inherit', 'inherit'],
    })
  }

  async containerExists(): Promise<boolean> {
    const { containerName } = this.config.development
    return namedContainerExists(containerName)
  }

  private async createContainer(): Promise<void> {
    const { postgresDockerImage } = this
    const {
      development: { containerName, port },
    } = this.config

    if (await this.containerExists()) {
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
      await this.stop()
    }

    console.error(`Container ${containerName} is ready to use`)
  }

  async performCreate(): Promise<void> {
    if (await this.containerExists()) {
      const { containerName } = this.config.development
      console.error(`Container ${containerName} already exists; nothing to do.`)
    } else {
      await this.createContainer()
    }
  }

  private async start(
    { attach }: { attach: boolean } = { attach: false }
  ): Promise<void> {
    const { containerName } = this.config.development
    if (attach) {
      console.error(`Attaching to container ${containerName}`)
      await spawn('docker', ['start', containerName, '--attach'], {
        stdio: 'inherit',
      })
    } else {
      await spawn('docker', ['start', containerName], {
        stdio: ['ignore', 'ignore', 'inherit'],
      })
    }
  }

  async performStart({ attach }: { attach: boolean }): Promise<void> {
    if (!(await this.containerExists())) {
      await this.createContainer()
    }
    await this.start({ attach })
  }

  private async stop(): Promise<void> {
    const { containerName } = this.config.development
    console.error(`Stopping container ${containerName}`)
    await stopContainer(containerName)
  }

  async performStop(): Promise<void> {
    if (await this.containerExists()) {
      await this.stop()
    }
  }

  async performRemoveContainer(): Promise<void> {
    const { containerName } = this.config.development

    if (!(await namedContainerExists(containerName))) {
      console.error(`Container ${containerName} doesn't exist; nothing to do.`)
      return
    }

    await this.stop()
    await removeContainer(containerName)
    console.error(`Removed container ${containerName}`)
  }

  async performRunPsql(databaseUrl: string): Promise<void> {
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

  async performRun(
    command: Readonly<string>,
    args: ReadonlyArray<string>
  ): Promise<void> {
    const { appDatabaseUrl } = this
    if (!(await this.containerExists())) {
      await this.createContainer()
    }

    await this.start()

    // try {
    await spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: appDatabaseUrl },
    })
    // } catch (e) {
    // Silence exceptions.
    // }
  }

  private async getSchema(): Promise<string> {
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

  async performWriteSchema(): Promise<void> {
    const schema = await this.getSchema()
    await createDirForTargetFile(SCHEMA_EXPORT_PATH)
    await fs.writeFile(SCHEMA_EXPORT_PATH, schema, { encoding: 'utf-8' })
  }

  async performCheckSchema(): Promise<void> {
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
