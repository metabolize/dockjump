import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import dirtyChai from 'dirty-chai'
import fs from 'fs'
import path from 'path'
import tmp from 'tmp-promise'
import { JsonValue } from 'type-fest'

import {
  loadJson,
  withTemporaryWorkingDirectory,
  writeFile,
} from './fs-test-helpers.js'
import { Runner } from './runner.js'
import {
  ERROR_SCHEMA_TS,
  EXAMPLE_SCHEMA_TS,
  EXPECTED_JSON_SCHEMA,
} from './test-fixtures.js'

chai.use(chaiAsPromised)
chai.use(dirtyChai)

class TestHarness {
  dir: tmp.DirectoryResult
  runner: Runner

  constructor({ dir }: { dir: tmp.DirectoryResult }) {
    this.dir = dir
    this.runner = new Runner({ basedir: dir.path })
  }

  static async create(): Promise<TestHarness> {
    const dir = await tmp.dir({ unsafeCleanup: true })
    return new TestHarness({ dir })
  }

  join(relativePath: string): string {
    return path.join(this.dir.path, relativePath)
  }

  async writeFile(relativePath: string, contents: string): Promise<void> {
    return writeFile(this.join(relativePath), contents)
  }

  async loadJson(relativePath: string): Promise<JsonValue> {
    return loadJson(this.join(relativePath))
  }

  existsSync(relativePath: string): boolean {
    return fs.existsSync(this.join(relativePath))
  }

  async withTemporaryWorkingDirectory<Result>(
    fn: () => Result
  ): Promise<Result> {
    return withTemporaryWorkingDirectory(this.dir.path, fn)
  }

  async cleanup(): Promise<void> {
    if (this.dir) {
      await this.dir.cleanup()
    }
  }
}

describe('Runner', () => {
  let harness: TestHarness
  beforeEach(async () => {
    harness = await TestHarness.create()
  })
  afterEach(() => harness.cleanup())

  const schemaSourceRelativePath = 'example/this.schema.ts'
  beforeEach(() =>
    harness.writeFile(schemaSourceRelativePath, EXAMPLE_SCHEMA_TS)
  )

  describe('`update()`', function () {
    this.timeout('5s')

    it('creates the expected JSON Schema file', async function () {
      const { generatedJsonSchemaRelativePaths } =
        await harness.withTemporaryWorkingDirectory(() =>
          harness.runner.update()
        )

      expect(generatedJsonSchemaRelativePaths).to.deep.equal([
        'example/generated/this.schema.json',
      ])

      // Appease the compiler.
      if (!generatedJsonSchemaRelativePaths) {
        throw Error("Shouldn't get here")
      }

      const generated = await harness.loadJson(
        generatedJsonSchemaRelativePaths[0]
      )
      expect(generated).to.deep.equal(EXPECTED_JSON_SCHEMA)
    })

    context('when an extra generated schema file is present', () => {
      const extraGeneratedSchema = 'foobar/generated/schema.json'
      beforeEach(() => harness.writeFile(extraGeneratedSchema, ''))

      it('removes it', async function () {
        // Confidence check.
        expect(harness.existsSync(extraGeneratedSchema)).to.be.true()

        // Act.
        const { deletedSchemaPaths } =
          await harness.withTemporaryWorkingDirectory(() =>
            harness.runner.update()
          )

        // Assert.
        expect(deletedSchemaPaths).to.have.members([extraGeneratedSchema])
        expect(harness.existsSync(extraGeneratedSchema)).to.be.false()
      })
    })

    context('when an error occurs', () => {
      const errorSchemaSourceRelativePath = 'example/error.schema.ts'
      beforeEach(() =>
        harness.writeFile(errorSchemaSourceRelativePath, ERROR_SCHEMA_TS)
      )

      it('the expected error is thrown', async () => {
        await expect(
          harness.withTemporaryWorkingDirectory(() => harness.runner.update())
        ).to.be.rejectedWith(
          Error,
          "Cannot find module 'nonexistent' or its corresponding type declarations"
        )
      })
    })
  })

  describe('`check()`', function () {
    context('when an extra generated schema file is present', () => {
      const extraGeneratedSchema = 'foobar/generated/schema.json'
      beforeEach(() => harness.writeFile(extraGeneratedSchema, ''))

      it('throws an error', async function () {
        // Confidence check.
        expect(harness.existsSync(extraGeneratedSchema)).to.be.true()

        // Act.
        expect(
          await harness.withTemporaryWorkingDirectory(() =>
            harness.runner.check()
          )
        ).to.deep.contain({ spurious: [extraGeneratedSchema], isValid: false })
      })
    })
  })
})
