export interface Config {
  development: {
    databaseName: string
    port?: number
  }
  postgresVersion?: string
}

export const DEFAULT_CONFIG: Required<Config> = {
  development: {
    databaseName: 'unused',
    port: 15432,
  },
  postgresVersion: '13.2',
}
