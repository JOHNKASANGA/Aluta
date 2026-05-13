"use client";

import { useState, useRef, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";

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

type Session = {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "aluta:sessions";
const ACTIVE_KEY = "aluta:active";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function deriveSessionName(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New session";
  if (firstUser.attachments && firstUser.attachments.length > 0) {
    return firstUser.attachments[0].name.replace(/\.[^.]+$/, "");
  }
  const trimmed = firstUser.content.trim();
  if (!trimmed) return "New session";
  return trimmed.length > 40 ? trimmed.slice(0, 40) + "…" : trimmed;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>(
    [],
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  // Load sessions on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const stored: Session[] = raw ? JSON.parse(raw) : [];
      setSessions(stored);
      const active = localStorage.getItem(ACTIVE_KEY);
      if (active && stored.find((s) => s.id === active)) {
        setActiveId(active);
        const found = stored.find((s) => s.id === active);
        if (found) setMessages(found.messages);
      }
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  }, []);

  // Save sessions whenever messages change
  useEffect(() => {
    if (messages.length === 0) return;
    let id = activeId;
    let updated: Session[];
    const now = Date.now();
    if (!id) {
      // Create new session
      id = generateId();
      const newSession: Session = {
        id,
        name: deriveSessionName(messages),
        messages,
        createdAt: now,
        updatedAt: now,
      };
      updated = [newSession, ...sessions];
      setActiveId(id);
      localStorage.setItem(ACTIVE_KEY, id);
    } else {
      // Update existing session
      updated = sessions.map((s) =>
        s.id === id
          ? {
              ...s,
              messages,
              name: deriveSessionName(messages),
              updatedAt: now,
            }
          : s,
      );
      if (!updated.find((s) => s.id === id)) {
        updated = [
          {
            id,
            name: deriveSessionName(messages),
            messages,
            createdAt: now,
            updatedAt: now,
          },
          ...updated,
        ];
      }
    }
    setSessions(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save sessions", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);
  // Derive current project from first user message attachment
  const currentProject = messages.find(
    (m) => m.role === "user" && m.attachments && m.attachments.length > 0,
  )?.attachments?.[0];

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is too large (max 10MB)`);
        continue;
      }
      const lower = file.name.toLowerCase();
      const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf");
      const isImage = file.type.startsWith("image/");
      const isDocx =
        lower.endsWith(".docx") ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const isText = lower.endsWith(".txt") || lower.endsWith(".md");

      if (!isPdf && !isImage && !isDocx && !isText) {
        setError(`${file.name} is not a supported file type`);
        continue;
      }

      if (isDocx || isText || isPdf) {
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/extract", { method: "POST", body: fd });
          if (!res.ok) {
            let errMsg = `Server returned ${res.status}`;
            try {
              const data = await res.json();
              errMsg = data.error || errMsg;
            } catch {
              const text = await res.text();
              errMsg = text.slice(0, 100) || errMsg;
            }
            throw new Error(errMsg);
          }
          const data = await res.json();
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
        type: "image",
        mediaType: file.type,
        data,
        name: file.name,
      });
    }
    setPendingAttachments((prev) => [...prev, ...newAttachments]);
  }

  async function send() {
    if ((!input.trim() && pendingAttachments.length === 0) || loading) return;

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

  function newSession() {
    setMessages([]);
    setInput("");
    setPendingAttachments([]);
    setError("");
    setActiveId(null);
    localStorage.removeItem(ACTIVE_KEY);
  }

  function loadSession(id: string) {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    setMessages(s.messages);
    setActiveId(id);
    setInput("");
    setPendingAttachments([]);
    setError("");
    localStorage.setItem(ACTIVE_KEY, id);
    setSidebarOpen(false);
  }

  function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (activeId === id) {
      setMessages([]);
      setActiveId(null);
      localStorage.removeItem(ACTIVE_KEY);
    }
  }

  return (
    <div
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
      className="min-h-screen flex bg-[#FAF6EE] text-[#1A1033]"
    >
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:static inset-y-0 left-0 z-30 w-72 bg-[#1A0B3D] text-[#FAF6EE] flex flex-col transition-transform shadow-2xl`}
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src="/aluta-logo.png"
              alt="Aluta"
              className="w-11 h-11 rounded-full ring-2 ring-[#E5B045]/40"
            />
            <div>
              <h1
                className="text-2xl font-black tracking-tight"
                style={{ fontFamily: "Fraunces, serif" }}
              >
                Aluta
              </h1>
              <p className="text-xs text-[#E5B045] font-medium tracking-wide">
                Practice the panic.
              </p>
            </div>
          </div>
        </div>

        {/* New session button */}
        <div className="px-4 py-4 border-b border-white/10">
          <button
            onClick={newSession}
            className="w-full bg-[#E5B045] hover:bg-[#F0C055] text-[#1A0B3D] font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span>+</span>
            <span>New defence session</span>
          </button>
        </div>

        {/* Current project */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">
            Current project
          </div>
          {currentProject ? (
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-lg">📄</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {currentProject.name}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">
                    Loaded · {messages.length} messages
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-white/40 italic">
              No project loaded. Upload a PDF or paste your project details to
              begin.
            </div>
          )}
        </div>

        <div className="px-4 py-4 flex-1 overflow-y-auto">
          {/* Recent sessions */}
          {sessions.length > 0 && (
            <div className="mb-6">
              <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">
                Recent sessions
              </div>
              <div className="space-y-1">
                {sessions.slice(0, 10).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      activeId === s.id
                        ? "bg-[#E5B045]/15 border border-[#E5B045]/30"
                        : "hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {s.name}
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5">
                        {formatRelative(s.updatedAt)} · {s.messages.length} msgs
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 text-xs ml-2 transition-opacity"
                      aria-label="Delete session"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modes */}
          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-3">
            Modes
          </div>
          <div className="space-y-1.5">
            <ModeRow
              icon="🛡️"
              label="Defence"
              tag="Active"
              active
              accent="#E5B045"
            />
            <ModeRow icon="📚" label="Tutor" tag="v2" />
            <ModeRow icon="📖" label="Reading Guide" tag="v2" />
            <ModeRow icon="📅" label="Scheduler" tag="v2" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9 ring-2 ring-[#E5B045]/40",
                },
              }}
            />
            <div className="text-xs">
              <div className="font-medium text-white/80">Your account</div>
              <div className="text-white/40">Click avatar to manage</div>
            </div>
          </div>
          <div className="text-[10px] text-white/30">Aluta v1</div>
        </div>
      </aside>

      {/* Sidebar toggle (mobile) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-40 bg-[#1A0B3D] text-[#FAF6EE] p-2 rounded-lg shadow-lg"
      >
        ☰
      </button>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="border-b border-[#1A0B3D]/10 bg-[#FAF6EE]/80 backdrop-blur-sm px-6 md:px-10 py-4 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E5B045] animate-pulse"></span>
                <span className="text-xs uppercase tracking-widest text-[#1A0B3D]/60 font-bold">
                  Defence Mode
                </span>
              </div>
              <h2
                className="text-2xl md:text-3xl font-bold mt-1"
                style={{ fontFamily: "Fraunces, serif" }}
              >
                The External Examiner
              </h2>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-[#1A0B3D] text-[#FAF6EE] px-4 py-2 rounded-full text-xs font-medium">
              <span>🎓</span>
              <span>Pass the panel</span>
            </div>
          </div>
        </header>

        {/* Chat / hero area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 md:px-10 py-6"
        >
          {messages.length === 0 && (
            <div className="max-w-3xl mx-auto">
              {/* Hero card */}
              <div className="bg-gradient-to-br from-[#1A0B3D] to-[#2D1762] text-[#FAF6EE] rounded-3xl p-8 md:p-10 shadow-xl relative overflow-hidden mb-6">
                {/* Decorative element */}
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#E5B045]/20 blur-3xl"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[#E5B045]/10 blur-2xl"></div>

                <div className="relative">
                  <div className="inline-flex items-center gap-2 bg-[#E5B045]/20 text-[#E5B045] px-3 py-1 rounded-full text-xs font-semibold mb-4">
                    <span>🛡️</span>
                    <span>Headline Feature</span>
                  </div>
                  <h3
                    className="text-3xl md:text-4xl font-black leading-tight mb-3"
                    style={{ fontFamily: "Fraunces, serif" }}
                  >
                    Rehearse your defence.
                    <br />
                    Walk in ready.
                  </h3>
                  <p className="text-[#FAF6EE]/80 text-base leading-relaxed max-w-xl">
                    Aluta plays your external examiner. It reads your project,
                    asks the hard questions, catches contradictions, and tells
                    you exactly what to fix.
                  </p>
                </div>
              </div>

              {/* Feature row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <FeatureTile
                  num="01"
                  title="Share your work"
                  body="Upload your project PDF, .docx, or paste your details."
                />
                <FeatureTile
                  num="02"
                  title="Get questioned"
                  body="Aluta probes for weaknesses chapter by chapter."
                />
                <FeatureTile
                  num="03"
                  title="Walk in ready"
                  body="A verdict and three things to fix before the real defence."
                />
              </div>

              {/* Prompt suggestion */}
              <div className="bg-white border-2 border-dashed border-[#1A0B3D]/15 rounded-2xl p-5">
                <div className="text-[10px] uppercase tracking-widest text-[#1A0B3D]/50 font-bold mb-2">
                  Try this to start
                </div>
                <div
                  className="text-sm text-[#1A1033] italic leading-relaxed"
                  style={{ fontFamily: "Fraunces, serif" }}
                >
                  &ldquo;My project is titled [title]. My research questions are
                  [questions]. I used [methodology]. My main finding is
                  [finding].&rdquo;
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  m.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {m.role === "user" ? (
                  <div className="w-10 h-10 rounded-full bg-[#E5B045] flex items-center justify-center text-[#1A0B3D] text-xs font-bold flex-shrink-0 shadow-sm">
                    YOU
                  </div>
                ) : (
                  <img
                    src="/aluta-logo.png"
                    alt="Examiner"
                    className="w-10 h-10 rounded-full flex-shrink-0 shadow-sm ring-2 ring-[#E5B045]/30"
                  />
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm ${
                    m.role === "user"
                      ? "bg-[#1A0B3D] text-[#FAF6EE] rounded-tr-sm"
                      : "bg-white text-[#1A1033] border border-[#1A0B3D]/10 rounded-tl-sm"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="text-[10px] uppercase tracking-widest font-bold text-[#1A0B3D]/60 mb-2">
                      External Examiner
                    </div>
                  )}
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {m.attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className={`text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                            m.role === "user"
                              ? "bg-white/15 text-[#FAF6EE]"
                              : "bg-[#1A0B3D]/5 text-[#1A0B3D]"
                          }`}
                        >
                          <span>
                            {att.type === "pdf"
                              ? "📄"
                              : att.type === "image"
                                ? "🖼️"
                                : "📝"}
                          </span>
                          <span className="max-w-[140px] truncate">
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
                <img
                  src="/aluta-logo.png"
                  alt="Examiner"
                  className="w-10 h-10 rounded-full ring-2 ring-[#E5B045]/30 shadow-sm"
                />
                <div className="bg-white border border-[#1A0B3D]/10 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-[#1A0B3D] rounded-full animate-bounce"></span>
                    <span
                      className="w-2 h-2 bg-[#1A0B3D] rounded-full animate-bounce"
                      style={{ animationDelay: "0.15s" }}
                    ></span>
                    <span
                      className="w-2 h-2 bg-[#1A0B3D] rounded-full animate-bounce"
                      style={{ animationDelay: "0.3s" }}
                    ></span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-800 rounded-r-lg px-4 py-3 text-sm">
                <span className="font-semibold">Error:</span> {error}
              </div>
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-[#1A0B3D]/10 bg-white px-6 md:px-10 py-4">
          <div className="max-w-3xl mx-auto">
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pendingAttachments.map((att, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-[#1A0B3D]/5 text-[#1A0B3D] px-3 py-1.5 rounded-lg text-xs border border-[#1A0B3D]/15"
                  >
                    <span>
                      {att.type === "pdf"
                        ? "📄"
                        : att.type === "image"
                          ? "🖼️"
                          : "📝"}
                    </span>
                    <span className="max-w-[180px] truncate font-medium">
                      {att.name}
                    </span>
                    <button
                      onClick={() =>
                        setPendingAttachments((prev) =>
                          prev.filter((_, idx) => idx !== i),
                        )
                      }
                      className="text-[#1A0B3D]/40 hover:text-[#1A0B3D] font-bold ml-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-[#FAF6EE] border-2 border-[#1A0B3D]/10 focus-within:border-[#1A0B3D]/30 rounded-2xl p-3 transition-colors">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={
                  messages.length > 0
                    ? "Defend your answer..."
                    : "Paste your project, or attach a PDF to begin..."
                }
                rows={2}
                className="w-full bg-transparent text-sm text-[#1A1033] placeholder-[#1A0B3D]/40 focus:outline-none resize-none px-2 py-1"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*,.docx,.txt,.md"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />
              <div className="flex items-center justify-between pt-2 border-t border-[#1A0B3D]/10">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[#1A0B3D]/60 hover:text-[#1A0B3D] text-sm flex items-center gap-1.5 px-2 font-medium"
                >
                  <span>📎</span>
                  <span>Attach</span>
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[#1A0B3D]/40 hidden md:inline">
                    Enter to send · Shift + Enter for new line
                  </span>
                  <button
                    onClick={send}
                    disabled={
                      loading ||
                      (!input.trim() && pendingAttachments.length === 0)
                    }
                    className="bg-[#1A0B3D] hover:bg-[#2D1762] text-[#FAF6EE] px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    Send
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ModeRow({
  icon,
  label,
  tag,
  active = false,
  accent = "#E5B045",
}: {
  icon: string;
  label: string;
  tag: string;
  active?: boolean;
  accent?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg ${
        active ? "bg-white/10" : "opacity-50"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span
        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
          active ? "" : "text-white/40 border border-white/20"
        }`}
        style={active ? { backgroundColor: accent, color: "#1A0B3D" } : {}}
      >
        {tag}
      </span>
    </div>
  );
}

function FeatureTile({
  num,
  title,
  body,
}: {
  num: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-white border border-[#1A0B3D]/10 rounded-2xl p-5 hover:border-[#E5B045]/50 transition-colors">
      <div
        className="text-3xl font-black text-[#E5B045] mb-2"
        style={{ fontFamily: "Fraunces, serif" }}
      >
        {num}
      </div>
      <div
        className="font-bold text-[#1A0B3D] mb-1"
        style={{ fontFamily: "Fraunces, serif" }}
      >
        {title}
      </div>
      <div className="text-xs text-[#1A0B3D]/70 leading-relaxed">{body}</div>
    </div>
  );
}
