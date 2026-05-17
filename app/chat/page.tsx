"use client";

import { useState, useRef, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useVoice } from "@/lib/useVoice";

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
function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Working late";
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const messagesRef = useRef<Message[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const voiceTurnRef = useRef<(t: string) => void>(() => {});
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<"defence" | "tutor">("defence");
  const [greeting, setGreeting] = useState("Hello");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>(
    [],
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  useEffect(() => {
    setGreeting(getTimeGreeting());
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    voiceTurnRef.current = handleVoiceTurn;
  });

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("mode");
    if (m === "tutor" || m === "defence") setMode(m);
  }, []);

  const {
    state: voiceState,
    interimTranscript,
    supported: voiceSupported,
    permissionDenied,
    startListening,
    stopListening,
    speak,
    reset: resetVoice,
  } = useVoice({
    onUserSpoke: (t) => voiceTurnRef.current(t),
  });
  // Load session list on mount
  // Load session list whenever mode changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/sessions?mode=${mode}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setSessions(
          (data.sessions || []).map(
            (s: {
              id: string;
              name: string;
              created_at: string;
              updated_at: string;
            }) => ({
              id: s.id,
              name: s.name,
              messages: [],
              createdAt: new Date(s.created_at).getTime(),
              updatedAt: new Date(s.updated_at).getTime(),
            }),
          ),
        );
      } catch (e) {
        console.error("Failed to load sessions", e);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mode]);
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

  async function handleVoiceTurn(transcript: string) {
    const userMessage: Message = { role: "user", content: transcript };
    const newMessages: Message[] = [...messagesRef.current, userMessage];
    setMessages(newMessages);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "defence", messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
      };
      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);

      // Persist to Supabase
      let sessionId = activeIdRef.current;
      if (!sessionId) {
        const sessionName = deriveSessionName(updatedMessages);
        const createRes = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: sessionName, mode: "defence" }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          sessionId = created.session.id;
          setActiveId(sessionId);
          setSessions((prev) => [
            {
              id: sessionId!,
              name: sessionName,
              messages: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            ...prev,
          ]);
          await fetch(`/api/sessions/${sessionId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [userMessage, assistantMessage],
            }),
          });
        }
      } else {
        await fetch(`/api/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [userMessage, assistantMessage] }),
        });
      }

      // Speak the examiner's reply
      speak(data.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      resetVoice();
    }
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
      // Get Claude's reply
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
      };
      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);

      // Save to Supabase
      let sessionId = activeId;
      if (!sessionId) {
        // Create new session in DB
        const sessionName = deriveSessionName(updatedMessages);
        const createRes = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: sessionName, mode }),
        });
        if (!createRes.ok) throw new Error("Could not create session");
        const created = await createRes.json();
        sessionId = created.session.id;
        setActiveId(sessionId);

        // Add to sidebar list immediately
        setSessions((prev) => [
          {
            id: sessionId!,
            name: sessionName,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          ...prev,
        ]);

        // Save BOTH messages (the user one + Claude's reply)
        await fetch(`/api/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [userMessage, assistantMessage],
          }),
        });
      } else {
        // Append to existing session
        await fetch(`/api/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [userMessage, assistantMessage],
          }),
        });

        // Bump in sidebar
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  updatedAt: Date.now(),
                  name: deriveSessionName(updatedMessages),
                }
              : s,
          ),
        );
      }
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
  }

  function switchMode(newMode: "defence" | "tutor") {
    if (newMode === mode) return;
    setMode(newMode);
    setMessages([]);
    setInput("");
    setPendingAttachments([]);
    setError("");
    setActiveId(null);
    setSidebarOpen(false);
  }

  async function loadSession(id: string) {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) throw new Error("Could not load session");
      const data = await res.json();
      const loadedMessages: Message[] = (data.messages || []).map(
        (m: { role: string; content: string; attachments: unknown }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          attachments: (m.attachments as Message["attachments"]) || undefined,
        }),
      );
      setMessages(loadedMessages);
      setActiveId(id);
      setInput("");
      setPendingAttachments([]);
      setError("");
      setSidebarOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load session");
    }
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeId === id) {
        setMessages([]);
        setActiveId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  function renderInputBox() {
    return (
      <>
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 rounded-r-lg px-4 py-3 text-sm mb-2">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}
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
        <div className="bg-white border-2 border-[#1A0B3D]/10 focus-within:border-[#E5B045]/60 rounded-3xl p-3 shadow-lg transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              mode === "defence"
                ? "Paste your project, or attach a PDF to begin..."
                : "What topic or problem are you working on?"
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
                  loading || (!input.trim() && pendingAttachments.length === 0)
                }
                className="bg-[#1A0B3D] hover:bg-[#2D1762] text-[#FAF6EE] px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                Send
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
      className="h-screen overflow-hidden flex bg-[#FAF6EE] text-[#1A1033]"
    >
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 ${
          sidebarCollapsed ? "md:w-0 md:overflow-hidden md:border-0" : "md:w-72"
        } fixed md:static inset-y-0 left-0 z-30 w-72 bg-[#1A0B3D] text-[#FAF6EE] flex flex-col transition-all duration-300 shadow-2xl`}
      >
        {/* Logo + collapse toggle */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/aluta-logo.png"
              alt="Aluta"
              className="w-10 h-10 rounded-full ring-2 ring-[#E5B045]/40"
            />
            <div>
              <h1
                className="text-xl font-black tracking-tight"
                style={{ fontFamily: "Fraunces, serif" }}
              >
                Aluta
              </h1>
              <p className="text-[10px] text-[#E5B045] font-medium tracking-wide">
                Practice the panic.
              </p>
            </div>
          </Link>
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="hidden md:block text-white/40 hover:text-white text-lg"
            aria-label="Collapse sidebar"
          >
            «
          </button>
        </div>

        {/* Modes — at the top */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1.5">
            Modes
          </div>
          <div className="space-y-0.5">
            <ModeRow
              icon="🛡️"
              label="Defence"
              tag={mode === "defence" ? "Active" : ""}
              active={mode === "defence"}
              accent="#E5B045"
              onClick={() => switchMode("defence")}
            />
            <ModeRow
              icon="📚"
              label="Tutor"
              tag={mode === "tutor" ? "Active" : ""}
              active={mode === "tutor"}
              accent="#E5B045"
              onClick={() => switchMode("tutor")}
            />
            <ModeRow icon="📖" label="Reading Guide" tag="Soon" />
            <ModeRow icon="📅" label="Scheduler" tag="Soon" />
          </div>
        </div>

        {/* New session */}
        <div className="px-4 py-4 border-b border-white/10">
          <button
            onClick={newSession}
            className="w-full bg-[#E5B045] hover:bg-[#F0C055] text-[#1A0B3D] font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span>+</span>
            <span>New {mode === "defence" ? "defence" : "tutor"} session</span>
          </button>
        </div>

        {/* Current project — defence mode only */}
        {mode === "defence" && (
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
        )}

        {/* History */}
        <div className="px-4 py-4 flex-1 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">
            {mode === "defence" ? "Defence" : "Tutor"} history
          </div>
          {sessions.length > 0 ? (
            <div className="space-y-1">
              {sessions.slice(0, 15).map((s) => (
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
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">
                      {formatRelative(s.updatedAt)}
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
          ) : (
            <div className="text-xs text-white/30 italic">
              No sessions yet. Start a conversation to see it here.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <UserButton
              appearance={{
                elements: { avatarBox: "w-9 h-9 ring-2 ring-[#E5B045]/40" },
              }}
            />
            <div className="text-xs">
              <div className="font-medium text-white/80">Your account</div>
              <div className="text-white/40">Click avatar to manage</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Sidebar toggle — mobile open, desktop expand-when-collapsed */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-40 bg-[#1A0B3D] text-[#FAF6EE] p-2 rounded-lg shadow-lg"
      >
        ☰
      </button>
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="hidden md:block fixed top-4 left-4 z-40 bg-[#1A0B3D] text-[#FAF6EE] px-3 py-2 rounded-lg shadow-lg text-sm font-medium"
          aria-label="Expand sidebar"
        >
          » Menu
        </button>
      )}

      {/* Main area */}
      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Top bar */}
        <header className="border-b border-[#1A0B3D]/10 bg-[#FAF6EE]/80 backdrop-blur-sm px-6 md:px-10 py-4 z-20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E5B045] animate-pulse"></span>
                <span className="text-xs uppercase tracking-widest text-[#1A0B3D]/60 font-bold">
                  {mode === "defence" ? "Defence Mode" : "Tutor Mode"}
                </span>
              </div>
              <h2
                className="text-2xl md:text-3xl font-black mt-1"
                style={{ fontFamily: "Fraunces, serif" }}
              >
                {mode === "defence" ? (
                  <>
                    Face the{" "}
                    <span className="text-[#1A0B3D]">External Examiner</span>
                  </>
                ) : (
                  <>
                    Your <span className="text-[#1A0B3D]">Study Tutor</span>
                  </>
                )}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {mode === "defence" && (
                <button
                  onClick={() => setVoiceMode(true)}
                  className="flex items-center gap-2 bg-[#E5B045] hover:bg-[#F0C055] text-[#1A0B3D] px-4 py-2 rounded-full text-xs font-bold transition-colors"
                >
                  <span>🎙️</span>
                  <span>Voice Defence</span>
                </button>
              )}
              <div className="hidden md:flex items-center gap-2 bg-[#1A0B3D] text-[#FAF6EE] px-4 py-2 rounded-full text-xs font-medium">
                <span>{mode === "defence" ? "🎓" : "📚"}</span>
                <span>
                  {mode === "defence"
                    ? "Pass the panel"
                    : "Actually understand it"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {messages.length === 0 ? (
          /* EMPTY STATE — centered greeting + input on themed background */
          <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto">
            <div className="w-full max-w-2xl text-center mb-8">
              <h1
                className="text-3xl md:text-4xl font-black text-[#1A0B3D] mb-2"
                style={{ fontFamily: "Fraunces, serif" }}
              >
                {greeting}.
              </h1>
              <p className="text-[#1A0B3D]/60 text-base">
                {mode === "defence"
                  ? "Share your project and let's rehearse your defence."
                  : "Tell me what you're studying and where you're stuck."}
              </p>
            </div>
            <div className="w-full max-w-2xl bounce-in">{renderInputBox()}</div>
            <div className="text-xs text-[#1A0B3D]/40 mt-4 text-center max-w-md">
              {mode === "defence"
                ? "Upload your project PDF or paste your title, methodology, and findings."
                : "Ask about any topic. I'll find out where your understanding breaks down first."}
            </div>
          </div>
        ) : (
          /* ACTIVE STATE — messages scroll, input pinned at the bottom */
          <>
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 md:px-10 py-6"
            >
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
                        alt="Aluta"
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
                          {mode === "defence" ? "External Examiner" : "Tutor"}
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
                      alt="Aluta"
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
              </div>
            </div>

            <div className="border-t border-[#1A0B3D]/10 bg-[#FAF6EE] px-6 md:px-10 py-4 flex-shrink-0">
              <div className="max-w-3xl mx-auto">{renderInputBox()}</div>
            </div>
          </>
        )}
        {/* Voice Defence overlay */}
        {voiceMode && (
          <div className="fixed inset-0 z-50 bg-[#1A0B3D] flex flex-col items-center justify-center px-6">
            {/* Decorative glows */}
            <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-[#E5B045]/10 blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-[#E5B045]/10 blur-3xl"></div>

            <div className="relative flex flex-col items-center text-center max-w-lg w-full">
              <div className="text-[10px] uppercase tracking-widest text-[#E5B045] font-bold mb-8">
                Voice Defence · The External Examiner
              </div>

              {/* Orb */}
              <div className="relative w-44 h-44 mb-8 flex items-center justify-center">
                {voiceState === "listening" && (
                  <span className="absolute inset-0 rounded-full bg-[#E5B045]/30 animate-ping"></span>
                )}
                {voiceState === "speaking" && (
                  <span className="absolute inset-0 rounded-full bg-[#E5B045]/20 animate-pulse"></span>
                )}
                <div
                  className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300 ${
                    voiceState === "listening"
                      ? "bg-[#E5B045] scale-110"
                      : voiceState === "speaking"
                        ? "bg-[#E5B045]/80 scale-105"
                        : voiceState === "thinking"
                          ? "bg-white/10"
                          : "bg-white/5"
                  }`}
                >
                  <img
                    src="/aluta-logo.png"
                    alt="Aluta"
                    className="w-24 h-24 rounded-full"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="text-[#FAF6EE] text-lg font-semibold mb-2">
                {voiceState === "idle" && "Tap the mic to respond"}
                {voiceState === "listening" && "Listening..."}
                {voiceState === "thinking" && "The examiner is considering..."}
                {voiceState === "speaking" && "The examiner is speaking..."}
              </div>

              {/* Interim transcript */}
              <div className="text-[#FAF6EE]/60 text-sm min-h-[3rem] mb-6 italic">
                {interimTranscript ||
                  (messages.length === 0 && voiceState === "idle"
                    ? "Start by stating your project title and main findings."
                    : "")}
              </div>

              {!voiceSupported && (
                <div className="text-red-300 text-sm mb-4">
                  Voice isn&apos;t supported in this browser. Try Chrome, Edge,
                  or Brave.
                </div>
              )}
              {permissionDenied && (
                <div className="text-red-300 text-sm mb-4">
                  Microphone access was denied. Enable it in your browser
                  settings.
                </div>
              )}

              {/* Mic button */}
              <button
                onClick={() => {
                  if (voiceState === "idle") startListening();
                  else if (voiceState === "listening") stopListening();
                }}
                disabled={
                  !voiceSupported ||
                  voiceState === "thinking" ||
                  voiceState === "speaking"
                }
                className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all disabled:opacity-30 ${
                  voiceState === "listening"
                    ? "bg-red-500 text-white"
                    : "bg-[#E5B045] text-[#1A0B3D]"
                }`}
              >
                {voiceState === "listening" ? "■" : "🎙️"}
              </button>
              <div className="text-[#FAF6EE]/40 text-xs mt-3">
                {voiceState === "listening"
                  ? "Tap to stop and send"
                  : voiceState === "idle"
                    ? "Tap to speak"
                    : "Please wait"}
              </div>

              {/* End */}
              <button
                onClick={() => {
                  resetVoice();
                  setVoiceMode(false);
                }}
                className="mt-10 text-[#FAF6EE]/60 hover:text-[#FAF6EE] text-sm font-medium border border-white/20 hover:border-white/40 px-5 py-2 rounded-full transition-colors"
              >
                End voice session
              </button>
            </div>
          </div>
        )}
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
  onClick,
}: {
  icon: string;
  label: string;
  tag: string;
  active?: boolean;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${
        onClick ? "cursor-pointer" : ""
      } ${active ? "bg-white/10" : onClick ? "hover:bg-white/5" : "opacity-50"}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      {tag && (
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
            active ? "" : "text-white/40 border border-white/20"
          }`}
          style={active ? { backgroundColor: accent, color: "#1A0B3D" } : {}}
        >
          {tag}
        </span>
      )}
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
