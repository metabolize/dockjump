# Dockjump

Docker-based PostgreSQL developer environment with the extraordinarily
thoughtful SQL-powered roll-forward migration tool [Graphile Migrate][].

While graphile-migrate is opinionated about how to do migrations, it is agnostic
about how you run your development databases. Dockjump fills that niche,
providing local Docker-based PostgreSQL that just works out of the box. It sets
up the necessary root, shadow, and application databases for graphile-migrate to
do its thing.

In production, Dockjump is not in the picture: you run
`graphile-migrate migrate` the usual way.

We've been using this pattern for a while at Metabolize–Curvewise with a
Postgraphile/CRA project running on MacOS and Linux hosts. Dockjump would work
equally well on any Postgres project, including with `npx` if you're not using
Node.

This tooling is new and considered alpha. Developer feedback and contributions
welcome!

[graphile migrate]: https://github.com/graphile/migrate

## Installation

```sh
npm install --save pg graphile-migrate
npm install --save-dev dockjump pg
```

## How it works

- `dockjump init` writes out `.gmrc` and `.env` and runs
  `graphile-migrate init`.
- `dockjump start` starts a Docker container with the necessary databases.
- With the container running, you can use `graphile-migrate migrate` or
  `graphile-migrate watch` and connect to the database from the host machine
  as usual.
- Write your migration in `dockjump/current.sql`.
- After committing migrations, hooks configured in gmrc invoke
  `dockjump export-schema` to export the schema.
- In CI, run checks to make sure the exported schema is up to date and
  `current.sql` is empty-ish.

## Features

- Provisions a local, application-specific docker container
- Within the container, provisions root, application, and shadow databases
- Provides commands convenient for interacting with the container, database,
  schema, and migrations - Generate `.gmrc.js`
- After running migrations, re-exports the schema
- Verifies the exported schema is up to date (useful for running in CI)
- Checks that `dockjump/current.sql` is empty-ish (also useful in CI)
- Runs from the command line with zero boilerplate
- Works with Node-based and non-Node-based projects

## Related projects

An alternative to this project is [Graphile Starter][], a batteries-included
boilerplate template by the author of graphile-migrate which runs an entire
Postgraphile&ndash;Next.js application locally or in Docker.

In dockjump, graphile-migrate runs in the host OS, not docker as in
[docker example][].

[graphile starter]: https://github.com/graphile/starter
[docker example]: https://github.com/graphile/migrate/blob/main/docs/docker/README.md

## Acknowledgements

Serious thanks to [Benjie][] and [Jem][] for maintaining the wonderful Graphile
suite. And thanks to [Jacob Beard][] who convinced me it was worthwhile to write
SQL again.

A few patterns in this tool were gleaned from [Graphile Starter][].

The name of this package was inspired by [mail jumping][], a practice which
involves Docks&hellip; and the Post.

![](https://fh-sites.imgix.net/sites/4390/2020/08/31200405/U.S.-Mailboat-Tour-image-1.jpg?auto=compress%2Cformat&w=700&h=700&fit=max)

[mail jumping]: https://www.atlasobscura.com/articles/mail-jumping-lake-geneva

[benjie]: https://github.com/benjie
[jem]: https://github.com/jemgillam
[jacob beard]: https://github.com/jbeard4
