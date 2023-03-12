set -eo pipefail

export PGHOST=host.docker.internal
export PGUSER=postgres
export PGPASSWORD=postgres

[ -z "$PGPORT" ] && echo "PGPORT is required" && exit 2
[ -z "$APP_USERNAME" ] && echo "APP_USERNAME is required" && exit 2
[ -z "$APP_PASSWORD" ] && echo "APP_PASSWORD is required" && exit 2
[ -z "$APP_DATABASE_NAME" ] && echo "APP_DATABASE_NAME is required" && exit 2

set -u

createuser \
  ${APP_USERNAME}

psql \
  --set=ON_ERROR_STOP=on \
  postgres \
  -c "ALTER ROLE ${APP_USERNAME} WITH PASSWORD '${APP_PASSWORD}'"

createdb \
  ${APP_DATABASE_NAME} \
  --owner=${APP_USERNAME}

createdb \
  ${APP_DATABASE_NAME}_shadow \
  --owner=${APP_USERNAME}

psql \
  --set=ON_ERROR_STOP=on \
  ${APP_DATABASE_NAME} \
  -c "ALTER SCHEMA public OWNER TO ${APP_USERNAME}"
