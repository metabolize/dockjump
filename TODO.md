- [x] Pass additional arguments to psql. Use to get pg:reset working.
- [x] Implement pg_dump. Use to implement pg:dump.
- [x] Implement pg_dump schema. Use to implement pg:dump:schema.
- [x] Remove ts-node src/scripts/get-database-url.ts and intermediate
      scripts that reference it.
- [x] Figure out what's up in CI with loading DDL, pg:reseed, etc. Add
      dockjump commands if necessary to help with this. Figure out how
      database URLs are set differently in production and how to pipe
      these into pg:migrate.
