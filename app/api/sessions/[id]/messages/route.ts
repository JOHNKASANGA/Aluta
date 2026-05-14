import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/sessions/[id]/messages — append messages to a session
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : null;
    if (!messages) {
      return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify session ownership
    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (sErr || !session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Insert messages
    const rows = messages.map(
      (m: { role: string; content: string; attachments?: unknown }) => ({
        session_id: id,
        user_id: userId,
        role: m.role,
        content: m.content || "",
        attachments: m.attachments || null,
      }),
    );

    const { error: insertErr } = await supabase.from("messages").insert(rows);
    if (insertErr) throw insertErr;

    // Bump session.updated_at
    await supabase
      .from("sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
