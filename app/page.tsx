"use client";

import Link from "next/link";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  Shield,
  BookOpen,
  Calendar,
  GraduationCap,
  ArrowRight,
  Lock,
} from "lucide-react";

const FEATURES = [
  {
    key: "tutor",
    icon: <GraduationCap size={26} />,
    name: "Tutor",
    short: "Understand any topic, properly.",
    long: "The Tutor diagnoses where your understanding actually breaks down before it explains anything. It checks that each step landed, lets you try again when you're wrong, and never just hands you the answer. Socratic by default, direct when you ask.",
    href: "/chat?mode=tutor",
    available: true,
  },
  {
    key: "reading",
    icon: <BookOpen size={26} />,
    name: "Reading Guide",
    short: "Turn any material into a study pack.",
    long: "Upload a chapter, lecture notes, or a past paper. Reading Guide produces a structural map, the must-know concepts ranked by importance, the trap zones where students lose marks, and practice questions in your lecturer's style.",
    href: "#",
    available: false,
  },
  {
    key: "scheduler",
    icon: <Calendar size={26} />,
    name: "Scheduler",
    short: "Study plans that actually hold up.",
    long: "Tell Scheduler what to cover and by when. It builds a day-by-day plan weighted toward your weak topics, with spaced repetition, real rest, and buffer time. Panic mode triages brutally when the exam is tomorrow.",
    href: "#",
    available: false,
  },
];

export default function Home() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
      className="min-h-screen bg-[#FAF6EE] text-[#1A1033]"
    >
      {/* Header */}
      <header className="border-b border-[#1A0B3D]/10 bg-[#FAF6EE]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/aluta-logo.png"
              alt="Aluta"
              className="w-10 h-10 rounded-full ring-2 ring-[#E5B045]/40"
            />
            <div>
              <div
                className="text-xl font-black tracking-tight text-[#1A0B3D]"
                style={{ fontFamily: "Fraunces, serif" }}
              >
                Aluta
              </div>
              <div className="text-[10px] text-[#1A0B3D]/60 font-medium tracking-wide uppercase">
                Practice the panic. Pass the panel.
              </div>
            </div>
          </div>
          <UserButton
            appearance={{
              elements: { avatarBox: "w-10 h-10 ring-2 ring-[#E5B045]/40" },
            }}
          />
        </div>
      </header>

      {/* Hero — Project Defence */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-8">
        <div className="bg-gradient-to-br from-[#1A0B3D] to-[#2D1762] text-[#FAF6EE] rounded-[2rem] p-10 md:p-14 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#E5B045]/20 blur-3xl"></div>
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-[#E5B045]/10 blur-2xl"></div>

          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-[#E5B045]/20 text-[#E5B045] px-3 py-1 rounded-full text-xs font-bold mb-5">
              <Shield size={14} />
              <span>HEADLINE FEATURE</span>
            </div>
            <h1
              className="text-4xl md:text-6xl font-black leading-[1.05] mb-5"
              style={{ fontFamily: "Fraunces, serif" }}
            >
              Project Defence,
              <br />
              rehearsed.
            </h1>
            <p className="text-[#FAF6EE]/80 text-lg leading-relaxed mb-8">
              Aluta plays your external examiner. It reads your project, asks
              the questions a real panel would ask, catches contradictions
              between your chapters, and tells you exactly what to fix before
              you walk into the room.
            </p>
            <Link
              href="/chat?mode=defence"
              className="inline-flex items-center gap-2 bg-[#E5B045] hover:bg-[#F0C055] text-[#1A0B3D] font-bold px-7 py-4 rounded-2xl text-base transition-colors shadow-lg"
            >
              Start Your Project Defence
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Feature bubbles */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-[#1A0B3D]/60 font-bold mb-1">
            The rest of Aluta
          </div>
          <h2
            className="text-2xl md:text-3xl font-black text-[#1A0B3D]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Hover to explore each feature
          </h2>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start">
          {FEATURES.map((f, i) => {
            const isHovered = hovered === i;
            const isShrunk = hovered !== null && hovered !== i;
            const Wrapper = f.available ? Link : "div";

            return (
              <Wrapper
                key={f.key}
                href={f.available ? f.href : "#"}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  flex: isHovered ? "2.4" : isShrunk ? "0.75" : "1",
                }}
                className={`group transition-all duration-300 ease-out w-full rounded-3xl border p-6 ${
                  f.available
                    ? "cursor-pointer bg-white border-[#1A0B3D]/10 hover:border-[#E5B045]/60 hover:shadow-xl"
                    : "cursor-default bg-[#FAF6EE] border-dashed border-[#1A0B3D]/20"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={
                      f.available ? "text-[#1A0B3D]" : "text-[#1A0B3D]/40"
                    }
                  >
                    {f.icon}
                  </div>
                  {f.available ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E5B045] text-[#1A0B3D]">
                      Live
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1A0B3D]/10 text-[#1A0B3D]/50">
                      <Lock size={9} />
                      Coming soon
                    </span>
                  )}
                </div>

                <div
                  className={`font-black text-xl mb-1 ${
                    f.available ? "text-[#1A0B3D]" : "text-[#1A0B3D]/60"
                  }`}
                  style={{ fontFamily: "Fraunces, serif" }}
                >
                  {f.name}
                </div>
                <div className="text-sm text-[#1A0B3D]/60">{f.short}</div>

                {/* Long description — expands on hover */}
                <div
                  className={`transition-all duration-300 ease-out overflow-hidden ${
                    isHovered
                      ? "max-h-60 opacity-100 mt-4"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="text-sm text-[#1A0B3D]/75 leading-relaxed border-t border-[#1A0B3D]/10 pt-4">
                    {f.long}
                  </div>
                  {f.available && (
                    <div className="flex items-center gap-1.5 text-[#1A0B3D] font-semibold text-sm mt-3">
                      Open {f.name}
                      <ArrowRight size={15} />
                    </div>
                  )}
                </div>
              </Wrapper>
            );
          })}
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-10 mt-6 border-t border-[#1A0B3D]/10 text-center text-xs text-[#1A0B3D]/50">
        ALUTA
      </footer>
    </div>
  );
}
