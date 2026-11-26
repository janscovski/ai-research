import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * On-demand refresh. Call with the secret in the `x-revalidate-secret` header
 * (preferred) or `?secret=`. Used by the Apps Script in scripts/apps-script.gs.
 */
function authorized(req: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  const given = req.headers.get("x-revalidate-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
  if (!expected || expected.length < 16) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });
  revalidatePath("/");
  return NextResponse.json({ ok: true, revalidated: "/", at: new Date().toISOString() });
}

export const POST = handle;
export const GET = handle;
