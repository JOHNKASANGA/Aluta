import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET /api/sessions?mode=defence — list sessions for the signed-in user, filtered by mode
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mode = req.nextUrl.searchParams.get("mode") || "defence";
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sessions")
      .select("id, name, mode, created_at, updated_at")
      .eq("user_id", userId)
      .eq("mode", mode)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ sessions: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/sessions — create a new session with a mode
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, mode } = await req.json();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: userId,
        name: name || "New session",
        mode: mode || "defence",
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ session: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}