#!/usr/bin/env ts-node-script

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
  subparsers.add_parser('db-url', {
    help: 'Print the URL for the application database',
  })
  subparsers.add_parser('psql', {
    help: 'Run psql against the running application database',
  })
  const run = subparsers.add_parser('run', {
    help: 'Run the given command with DATABASE_URL set in the environment',
  })
  run.add_argument('cmd', { metavar: 'command', help: 'command to run' })
  run.add_argument('args', { help: 'arguments to pass', nargs: '*' })
  subparsers.add_parser('export-schema', {
    help: 'Write the schema of the running application database to dockjump/generated.sql',
  })

  const args = parser.parse_args(inArgs)

  const config = await loadConfig()
  const runner = new Runner(config)

  switch (args.command) {
    case 'db-url':
      runner.printDatabaseUrl()
      break
    case 'psql':
      await runner.runPsql(runner.appDatabaseUrl)
      break
    case 'run':
      await runner.run(args.cmd, args.args)
      break
    case 'export-schema':
      await runner.exportSchema()
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
