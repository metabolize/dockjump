import { promises as fs } from 'fs'
import * as pathLib from 'path'

export async function createDirForTargetFile(dst: string): Promise<void> {
  await fs.mkdir(pathLib.dirname(dst), { recursive: true })
}
