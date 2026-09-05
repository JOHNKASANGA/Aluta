# Aluta

An AI study companion for university students, built with Next.js and Claude.

Aluta's headline feature is **Project Defence** — a simulated external examiner that reads your project and rehearses your oral defence with you before the real one. Alongside it, Aluta includes a **Tutor** for conversational subject help and a **Reading Guide** that turns any material into a structured study pack.

## Features

### 🛡️ Project Defence
Upload your project (PDF, .docx, image, or pasted text) and Aluta plays a hostile-but-fair external examiner. It reads your work, asks pointed questions, catches contradictions between chapters, demands citations for unsupported claims, and ends with a verdict and the most important fixes to make before your real defence.

Includes a **Voice Defence** mode — a full-screen, hands-free conversation with the examiner. Speech-to-text and text-to-speech run in the browser, with a voice-reactive orb that pulses in sync with your speech and the examiner's replies.

### 📚 Tutor
A conversational study tutor that diagnoses where your understanding actually breaks down before explaining anything. Checks comprehension after each explanation, uses concrete examples, and switches between Socratic and direct-explanation modes depending on what you ask for.

### 📖 Reading Guide
Upload a chapter, lecture notes, or a past paper. Aluta produces a five-section study pack:
1. **TL;DR** — plain-language summary
2. **Must-knows** — ranked key concepts
3. **Trap zones** — common mistakes and easily-confused terms
4. **Predicted questions** — in the style of your source material, with hints
5. **Asks** — smart questions to bring to your lecturer or TA

## Tech stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS (via Play CDN)
- **AI:** Anthropic Claude API
- **Auth:** Clerk (email/password + Google)
- **Database:** Supabase (Postgres) for session and message persistence
- **File parsing:** `unpdf` (PDF), `mammoth` (.docx)
- **Voice:** Web Speech API (SpeechRecognition + SpeechSynthesis) with Web Audio API for real-time voice-amplitude visualization
- **Icons:** Lucide
- **Deployment:** Vercel

## Getting started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com)
- A [Clerk](https://clerk.com) application (email + Google sign-in enabled)
- A [Supabase](https://supabase.com) project

### Installation

```bash
git clone <this-repo-url>
cd aluta
npm install
```

### Database setup

Run this in the Supabase SQL Editor:

```sql
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  mode text not null default 'defence',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  attachments jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_mode_idx
  on sessions(user_id, mode, updated_at desc);

create index if not exists messages_session_id_created_idx
  on messages(session_id, created_at asc);

alter table sessions enable row level security;
alter table messages enable row level security;
```

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure
app/
├── page.tsx # Landing page (feature bubbles, hero)
├── chat/page.tsx # Main chat interface (all 3 modes)
├── sign-in/[[...sign-in]]/ # Clerk sign-in page
├── sign-up/[[...sign-up]]/ # Clerk sign-up page
└── api/
├── chat/route.ts # Claude API proxy, mode-aware
├── extract/route.ts # PDF/.docx/.txt text extraction
└── sessions/
├── route.ts # List / create sessions
└── [id]/
├── route.ts # Get / rename / delete a session
└── messages/route.ts # Append messages to a session

lib/
├── prompts.ts # System prompts for each mode
├── claude.ts # Anthropic client wrapper
├── supabase.ts # Supabase admin client
├── useVoice.ts # Voice hook (speech recognition + synthesis + audio analysis)
└── speech.d.ts # Web Speech API type declarations

middleware.ts # Clerk auth middleware — protects all routes except sign-in/up
### Environment variables

Create a `.env.local` file in the project root:
ANTHROPIC_API_KEY=sk-ant-...

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

## Voice Defence notes

Voice relies on the Web Speech API, which is best supported in Chromium browsers (Chrome, Edge, Brave). It is not reliably supported in Firefox or Safari. The app detects support and shows a fallback message where it's unavailable.

Speech-to-text and text-to-speech run entirely in the browser at no API cost. The orb's pulsing animation is driven by real microphone amplitude while listening, and a simulated speech-like rhythm while Aluta is speaking (since synthesized audio isn't directly analyzable).

## Roadmap

- [ ] Scheduler — day-by-day study plans with a panic mode for cram situations
- [ ] Institutional licensing for departments and faculties
- [ ] Mobile app (PWA or native wrapper)

## License

Not yet licensed for reuse. All rights reserved.
