import { spawn } from 'child-process-promise'
import os from 'os'

export async function namedContainerExists(name: string): Promise<boolean> {
  const { stdout } = await spawn(
    'docker',
    ['ps', '--all', '--filter', `name=${name}`],
    { capture: ['stdout'] }
  )
  const lines = stdout.split(os.EOL).filter(Boolean)
  if (lines.length === 1) {
    // e.g. just column headers
    return false
  } else if (lines.length === 2) {
    // e.g. column headers and a container
    return true
  } else {
    throw Error(
      'Got a confusing result from `docker ps` while checking if the container exists'
    )
  }
}
