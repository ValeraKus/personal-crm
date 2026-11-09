import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

// The link from the email leads here: /api/auth/magic-link/verify.
// The login request itself goes through the form, but a direct request to
// /api/auth/sign-in/magic-link is handled by the same rules.
export function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
