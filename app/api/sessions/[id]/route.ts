import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/sessions/[id] — load one session with its messages
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();

    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (sErr || !session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: messages, error: mErr } = await supabase
      .from("messages")
      .select("role, content, attachments, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: true });

    if (mErr) throw mErr;

    return NextResponse.json({ session, messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/sessions/[id] — rename session
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const { name } = await req.json();
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("sessions")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/sessions/[id] — delete session and all messages
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
