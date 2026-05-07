import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  DEFENCE_PROMPT,
  TUTOR_PROMPT,
  READING_PROMPT,
  SCHEDULER_PROMPT,
} from "@/lib/prompts";

const PROMPTS: Record<string, string> = {
  defence: DEFENCE_PROMPT,
  tutor: TUTOR_PROMPT,
  reading: READING_PROMPT,
  scheduler: SCHEDULER_PROMPT,
};

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: {
    type: "pdf" | "image" | "text";
    mediaType: string;
    data: string;
    name: string;
  }[];
};

export async function POST(req: NextRequest) {
  try {
    const { mode, messages } = (await req.json()) as {
      mode: string;
      messages: IncomingMessage[];
    };

    if (!mode || !PROMPTS[mode]) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No messages" }, { status: 400 });
    }

    const claudeMessages = messages.map((m) => {
      if (m.role === "user" && m.attachments && m.attachments.length > 0) {
        const blocks: Anthropic.ContentBlockParam[] = [];
        for (const att of m.attachments) {
          if (att.type === "pdf") {
            blocks.push({
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: att.data,
              },
            });
          } else if (att.type === "image") {
            blocks.push({
              type: "image",
              source: {
                type: "base64",
                media_type: att.mediaType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: att.data,
              },
            });
          } else if (att.type === "text") {
            blocks.push({
              type: "text",
              text: `[Attached file: ${att.name}]\n\n${att.data}`,
            });
          }
        }
        if (m.content) blocks.push({ type: "text", text: m.content });
        return { role: "user" as const, content: blocks };
      }
      return { role: m.role, content: m.content };
    });

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: PROMPTS[mode],
      messages: claudeMessages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const reply = textBlock && textBlock.type === "text" ? textBlock.text : "";

    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
