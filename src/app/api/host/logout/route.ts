export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/host/logout — clear the session cookie. */
export async function POST() {
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie":
          "splitpot_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      },
    }
  );
}
