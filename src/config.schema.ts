export interface Config {
  development: {
    databaseName: string
    port?: number
    username?: string
    password?: string
  }
  postgresVersion?: string
}

export const DEFAULT_CONFIG: Required<Config> = {
  development: {
    databaseName: 'unused',
    port: 15432,
    username: 'dockjump_appuser',
    password: 'foobar',
  },
  postgresVersion: '13.2',
}
