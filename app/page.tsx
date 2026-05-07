"use client";

import { useState, useRef, useEffect } from "react";

type Attachment = {
  type: "pdf" | "image" | "text";
  mediaType: string;
  data: string;
  name: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
};
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>(
    [],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);
  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is too large (max 10MB)`);
        continue;
      }

      const name = file.name.toLowerCase();
      const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
      const isImage = file.type.startsWith("image/");
      const isDocx =
        name.endsWith(".docx") ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const isText = name.endsWith(".txt") || name.endsWith(".md");

      if (!isPdf && !isImage && !isDocx && !isText) {
        setError(`${file.name} is not a supported file type`);
        continue;
      }

      if (isDocx || isText) {
        // Extract text via API
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/extract", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Extraction failed");
          newAttachments.push({
            type: "text",
            mediaType: "text/plain",
            data: data.text,
            name: file.name,
          });
        } catch (e) {
          setError(
            `Could not read ${file.name}: ${
              e instanceof Error ? e.message : "unknown error"
            }`,
          );
        }
        continue;
      }

      // PDF and image: base64 encode
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      newAttachments.push({
        type: isPdf ? "pdf" : "image",
        mediaType: file.type,
        data,
        name: file.name,
      });
    }
    setPendingAttachments((prev) => [...prev, ...newAttachments]);
  }

  async function send() {
    if ((!input.trim() && pendingAttachments.length === 0) || loading) return;
    if (!started) setStarted(true);

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      attachments:
        pendingAttachments.length > 0 ? pendingAttachments : undefined,
    };
    const newMessages: Message[] = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setPendingAttachments([]);
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "defence", messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/aluta-logo.png"
              alt="Aluta"
              className="w-11 h-11 rounded-full shadow-md"
            />
            <div>
              <h1 className="text-lg font-bold text-stone-900">Aluta</h1>
              <p className="text-xs text-stone-500">
                Practice the panic. Pass the panel.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-medium">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
            Defence Mode
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Hero (only before first message) */}
        {!started && (
          <div className="mb-8">
            <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-8 mb-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="text-5xl">🎓</div>
                <div>
                  <h2 className="text-2xl font-bold text-stone-900 mb-2">
                    Practice your project defence
                  </h2>
                  <p className="text-stone-600 leading-relaxed">
                    Aluta plays the external examiner so you can rehearse before
                    the real one. Share your project, get grilled, learn what to
                    fix.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                  <div className="text-2xl mb-2">📄</div>
                  <div className="font-semibold text-stone-900 text-sm mb-1">
                    Share your work
                  </div>
                  <div className="text-xs text-stone-600">
                    Paste your title, methodology, and findings
                  </div>
                </div>
                <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
                  <div className="text-2xl mb-2">🔍</div>
                  <div className="font-semibold text-stone-900 text-sm mb-1">
                    Get questioned
                  </div>
                  <div className="text-xs text-stone-600">
                    Aluta probes for weaknesses, line by line
                  </div>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                  <div className="text-2xl mb-2">✅</div>
                  <div className="font-semibold text-stone-900 text-sm mb-1">
                    Walk in ready
                  </div>
                  <div className="text-xs text-stone-600">
                    Verdict and three things to fix
                  </div>
                </div>
              </div>

              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200">
                <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                  Try this to start
                </div>
                <div className="text-sm text-stone-700 italic">
                  "My project is titled [...]. My research questions are [...].
                  I used [methodology]. My main finding is [...]."
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conversation */}
        <div
          ref={scrollRef}
          className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {m.role === "user" ? (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 shadow-sm">
                  You
                </div>
              ) : (
                <img
                  src="/aluta-logo.png"
                  alt="Aluta"
                  className="w-9 h-9 rounded-full flex-shrink-0 shadow-sm"
                />
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white rounded-tr-sm"
                    : "bg-white text-stone-800 border border-stone-200 rounded-tl-sm"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="text-xs font-semibold text-indigo-600 mb-1">
                    External Examiner
                  </div>
                )}
                {m.attachments && m.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {m.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="bg-emerald-700/40 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                      >
                        <span>
                          {att.type === "pdf"
                            ? "📄"
                            : att.type === "image"
                              ? "🖼️"
                              : "📝"}
                        </span>
                        <span className="max-w-[120px] truncate">
                          {att.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                A
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                  <span
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.15s" }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.3s" }}
                  ></span>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 sticky bottom-4">
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 px-2">
              {pendingAttachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs border border-indigo-200"
                >
                  <span>{att.type === "pdf" ? "📄" : "🖼️"}</span>
                  <span className="max-w-[160px] truncate">{att.name}</span>
                  <button
                    onClick={() =>
                      setPendingAttachments((prev) =>
                        prev.filter((_, idx) => idx !== i),
                      )
                    }
                    className="text-indigo-400 hover:text-indigo-700 font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              started
                ? "Defend your answer..."
                : "Paste your project details, or upload your project PDF..."
            }
            rows={3}
            className="w-full bg-transparent text-sm text-stone-800 placeholder-stone-400 focus:outline-none resize-none px-2 py-1"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*,.docx,.txt,.md"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-stone-500 hover:text-indigo-600 text-sm flex items-center gap-1.5 px-2"
            >
              <span>📎</span>
              <span>Attach file</span>
            </button>
            <button
              onClick={send}
              disabled={
                loading || (!input.trim() && pendingAttachments.length === 0)
              }
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md transition-shadow flex items-center gap-2"
            >
              Send
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-stone-400 mt-8 pb-4">
          Built solo for Claude Hackathon UNILAG · Defence is one of four Aluta
          features · Tutor, Reading Guide, Scheduler coming soon
        </div>
      </div>
    </main>
  );
}
