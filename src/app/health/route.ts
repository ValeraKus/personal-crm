import { sql } from "drizzle-orm";

import { getDb } from "@/db";

// Always answer at request time: the deploy smoke check needs the live state
export const dynamic = "force-dynamic";

// Smoke check after a deploy: 200 when the app runs and the database answers.
// "version" is the git commit the running image was built from.
export async function GET() {
  const version = process.env.APP_VERSION ?? "dev";
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", version });
  } catch (error) {
    console.error("Health check failed: database is unreachable", error);
    return Response.json({ status: "error", version }, { status: 503 });
  }
}
