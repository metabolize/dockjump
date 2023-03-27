export interface ConfigInput {
  development: {
    containerName?: string
    databaseName: string
    port?: number
    username?: string
    password?: string
  }
  postgresVersion?: string
}
