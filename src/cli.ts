#!/usr/bin/env ts-node-script --esm

'use strict'

import { ArgumentParser } from 'argparse'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from './config.js'
import { Runner } from './runner.js'

export default async function main(inArgs?: string[]): Promise<void> {
  const { description, name, version } = JSON.parse(
    await fs.readFile(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        'package.json'
      ),
      'utf-8'
    )
  )

  const parser = new ArgumentParser({ prog: name, description })
  parser.add_argument('-v', '--version', { action: 'version', version })

  const subparsers = parser.add_subparsers({
    dest: 'command',
    title: 'subcommands',
    description: 'valid subcommands',
    required: true,
  })
  subparsers.add_parser('init', { help: 'Create .gmrc.js' })
  subparsers.add_parser('create', {
    help: "Create the database container (if it doesn't exist)",
  })
  const start = subparsers.add_parser('start', {
    help: `Start the container, creating it if it doesn't exist`,
  })
  start.add_argument('-a', '--attach', {
    help: 'Attach STDOUT/STDERR and forward signals',
    action: 'store_true',
  })
  subparsers.add_parser('db-url', {
    help: 'Print the URL for the application database',
  })
  const psql = subparsers.add_parser('psql', {
    help: 'Run psql against the running application database',
  })
  psql.add_argument('args', { help: 'arguments to pass', nargs: '*' })
  const run = subparsers.add_parser('run', {
    help: 'Run the given command with DATABASE_URL set in the environment',
  })
  run.add_argument('cmd', { metavar: 'command', help: 'command to run' })
  run.add_argument('args', { help: 'arguments to pass', nargs: '*' })
  subparsers.add_parser('write-schema', {
    help: 'Write the schema of the running application database to dockjump/generated.sql',
  })
  subparsers.add_parser('check-schema', {
    help: 'Check that dockjump/generated.sql is up to date',
  })
  subparsers.add_parser('stop', { help: `Stop the container if it's running` })
  subparsers.add_parser('clean', {
    help: 'Remove the database container if it exists',
  })

  const args = parser.parse_args(inArgs)

  const config = await loadConfig()
  const runner = new Runner(config)

  switch (args.command) {
    case 'init':
      await runner.performInit()
      break
    case 'create':
      await runner.performCreate()
      break
    case 'start':
      await runner.performStart({ attach: args.attach })
      break
    case 'db-url':
      runner.performPrintDatabaseUrl()
      break
    case 'psql':
      await runner.performRunPsql(runner.appDatabaseUrl, args.args)
      break
    case 'run':
      await runner.performRun(args.cmd, args.args)
      break
    case 'write-schema':
      await runner.performWriteSchema()
      break
    case 'check-schema':
      try {
        await runner.performCheckSchema()
      } catch (e) {
        process.exit(1)
      }
      break
    case 'stop':
      await runner.performStop()
      break
    case 'clean':
      await runner.performRemoveContainer()
      break
    default:
      throw Error(`Unknown command: ${args.command}`)
  }
}

;(async (): Promise<void> => {
  try {
    await main()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    process.exit(2)
  }
})()
