type DriverErrorFields = {
  code?: string;
  table_name?: string;
  column_name?: string;
  constraint_name?: string;
};

// What is safe to log about a failed query. Drizzle puts the query parameters into the error
// message, and Postgres quotes the failing row in "detail": both carry people's personal data.
// So logs get only codes and names from the schema, never messages or values.
// Fields are read by name, not with instanceof: the build may bundle drizzle and postgres twice.
export function dbErrorForLog(error: unknown) {
  // Drizzle keeps the error from the driver in "cause"
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  if (!(cause instanceof Error)) {
    return JSON.stringify({ name: typeof cause });
  }
  const fields = cause as Error & DriverErrorFields;
  if (!fields.code) {
    // Not from the database or the network, e.g. a TypeError
    return JSON.stringify({ name: cause.name });
  }
  return JSON.stringify({
    // Postgres error code such as 23514, or a connection one such as ECONNREFUSED
    code: fields.code,
    table: fields.table_name,
    column: fields.column_name,
    constraint: fields.constraint_name,
  });
}
