import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

import pdf from "pdf-parse";
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();

    let text = "";
    if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      text = buffer.toString("utf-8");
    } else if (name.endsWith(".pdf")) {
      const data = await pdf(buffer);
      text = data.text;
    } else {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 },
      );
    }

    // Truncate if absurdly long — keep first 30k chars (~7500 tokens)
    if (text.length > 30000) {
      text = text.slice(0, 30000) + "\n\n[Document truncated]";
    }

    return NextResponse.json({ text, name: file.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
