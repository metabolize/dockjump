#!/usr/bin/env ts-node-script

'use strict'

import { ArgumentParser } from 'argparse'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from './config'
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

  const args = parser.parse_args(inArgs)

  const config = await loadConfig()
  const runner = new Runner(config)

  switch (args.command) {
    case 'db-url':
      runner.printDatabaseUrl()
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
