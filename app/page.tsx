"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  Shield,
  BookOpen,
  Calendar,
  ArrowRight,
  GraduationCap,
  FileText,
  Search,
  CheckCircle2,
} from "lucide-react";

export default function Home() {
  return (
    <div
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
      className="min-h-screen bg-[#FAF6EE] text-[#1A1033]"
    >
      {/* Top bar */}
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

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12">
        <div className="bg-gradient-to-br from-[#1A0B3D] to-[#2D1762] text-[#FAF6EE] rounded-3xl p-10 md:p-14 shadow-xl relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[#E5B045]/20 blur-3xl"></div>
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-[#E5B045]/10 blur-2xl"></div>

          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-[#E5B045]/20 text-[#E5B045] px-3 py-1 rounded-full text-xs font-semibold mb-5">
              <Shield size={14} />
              <span>Headline feature: Aluta Defence</span>
            </div>
            <h1
              className="text-4xl md:text-6xl font-black leading-[1.05] mb-5"
              style={{ fontFamily: "Fraunces, serif" }}
            >
              Rehearse your defence.
              <br />
              Walk in ready.
            </h1>
            <p className="text-[#FAF6EE]/80 text-lg leading-relaxed mb-8 max-w-xl">
              Aluta plays your external examiner. It reads your project, asks
              the hard questions, catches contradictions, and tells you exactly
              what to fix before the real panel.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 bg-[#E5B045] hover:bg-[#F0C055] text-[#1A0B3D] font-bold px-6 py-3.5 rounded-xl text-base transition-colors shadow-lg"
            >
              Start a defence session
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-widest text-[#1A0B3D]/60 font-bold mb-2">
            How it works
          </div>
          <h2
            className="text-3xl md:text-4xl font-black text-[#1A0B3D]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Three steps from project to ready
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StepCard
            num="01"
            icon={<FileText size={22} />}
            title="Share your work"
            body="Upload your project PDF, .docx, or paste the title, methodology, and findings."
          />
          <StepCard
            num="02"
            icon={<Search size={22} />}
            title="Get questioned"
            body="Aluta probes for weaknesses chapter by chapter, demands citations, catches contradictions."
          />
          <StepCard
            num="03"
            icon={<CheckCircle2 size={22} />}
            title="Walk in ready"
            body="A verdict and the three most important things to fix before the real defence."
          />
        </div>
      </section>

      {/* What's coming */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="bg-white border border-[#1A0B3D]/10 rounded-3xl p-8 md:p-10">
          <div className="text-xs uppercase tracking-widest text-[#1A0B3D]/60 font-bold mb-2">
            What's coming
          </div>
          <h2
            className="text-2xl md:text-3xl font-black text-[#1A0B3D] mb-6"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            The full Aluta is on the way
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ComingSoon
              icon={<BookOpen size={20} />}
              title="Tutor"
              body="Conversational subject tutoring that diagnoses where you actually get stuck."
            />
            <ComingSoon
              icon={<GraduationCap size={20} />}
              title="Reading Guide"
              body="Turns any chapter or past paper into a structured study pack with predicted questions."
            />
            <ComingSoon
              icon={<Calendar size={20} />}
              title="Scheduler"
              body="Realistic day-by-day study plans with a panic mode for cram situations."
            />
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h3
          className="text-2xl md:text-3xl font-black text-[#1A0B3D] mb-4"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          Ready to rehearse?
        </h3>
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 bg-[#1A0B3D] hover:bg-[#2D1762] text-[#FAF6EE] font-bold px-6 py-3.5 rounded-xl text-base transition-colors shadow-lg"
        >
          Start a defence session
          <ArrowRight size={18} />
        </Link>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-[#1A0B3D]/10 text-center text-xs text-[#1A0B3D]/50">
        Aluta v1 · Built solo for Claude Hackathon UNILAG
      </footer>
    </div>
  );
}

function StepCard({
  num,
  icon,
  title,
  body,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-white border border-[#1A0B3D]/10 rounded-2xl p-6 hover:border-[#E5B045]/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div
          className="text-3xl font-black text-[#E5B045]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          {num}
        </div>
        <div className="text-[#1A0B3D]/40">{icon}</div>
      </div>
      <div
        className="font-bold text-[#1A0B3D] text-lg mb-2"
        style={{ fontFamily: "Fraunces, serif" }}
      >
        {title}
      </div>
      <div className="text-sm text-[#1A0B3D]/70 leading-relaxed">{body}</div>
    </div>
  );
}

function ComingSoon({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="border border-dashed border-[#1A0B3D]/15 rounded-2xl p-5 bg-[#FAF6EE]/50">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[#1A0B3D]/40">{icon}</div>
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1A0B3D]/10 text-[#1A0B3D]/60">
          v2
        </span>
      </div>
      <div
        className="font-bold text-[#1A0B3D] mb-1"
        style={{ fontFamily: "Fraunces, serif" }}
      >
        {title}
      </div>
      <div className="text-xs text-[#1A0B3D]/60 leading-relaxed">{body}</div>
    </div>
  );
}
