# Build Guide — Telegram Channels Dashboard

A step-by-step, non-technical guide to building the dashboard using **Claude in VS Code**. You don't need to write any code yourself — Claude does that. Your job is to follow the steps, paste the prompt, and answer Claude's questions.

Keep this file and `telegram-dashboard-plan.md` together — Claude will read the plan to understand what to build.

---

## Part 0 — What you'll end up with

- A web app running **on your own computer** first (so you can test it privately).
- Data stored in **Supabase** (a free online database).
- Code saved on **GitHub** (a safe backup + needed to go live).
- When it's perfect, one click to make it **live on the internet** (Vercel) for your team.

Nothing goes public until *you* decide. Everything before that is private on your machine.

---

## Part 1 — Create your free accounts (15 min, no coding)

Do these first. Use the **same email** for all three (decide now: your nexora.live email is the professional choice — not the personal gmail on the old sheet).

1. **GitHub** — go to github.com → Sign up. This stores your code.
2. **Supabase** — go to supabase.com → Start your project → sign in with GitHub. This is your database.
3. **Vercel** — go to vercel.com → Sign up with GitHub. This is for going live later (ignore it until Part 7).

Write down which email you used. That's it for now.

---

## Part 2 — Install the tools (20 min)

Install these in order. Just click through the default options.

1. **Node.js** — nodejs.org → download the big green **LTS** button → install. (This runs the app.)
2. **Git** — git-scm.com/downloads → download for your system → install with defaults. (This talks to GitHub.)
3. **VS Code** — code.visualstudio.com → download → install. (This is where you'll work.)
4. **Claude in VS Code** — open VS Code → click the **Extensions** icon on the left (four squares) → search **"Claude"** → install the official Anthropic one → sign in with your Claude account.

> If any installer asks scary technical questions, just accept the defaults and continue.

---

## Part 3 — Set up your project folder (5 min)

1. On your computer, make a new folder called `telegram-dashboard` (e.g. in Documents).
2. Copy **both** `telegram-dashboard-plan.md` and this `BUILD-GUIDE.md` into that folder.
3. Open VS Code → **File → Open Folder** → pick `telegram-dashboard`.
4. Open the Claude panel in VS Code (the Claude icon in the sidebar).

You're now ready to talk to Claude inside your project.

---

## Part 4 — The prompt to paste into Claude

Copy everything in the box below and paste it into the Claude chat in VS Code. Then just follow along — Claude will ask you questions and tell you what to click.

> ⚠️ Tell Claude to **stop and explain in plain English** whenever it wants you to do something. You are not technical, and that's fine.

```
I want you to build a web app for me. I am NOT a technical person, so please
explain every step in plain English, tell me exactly what to click, and pause
and wait whenever you need me to do something (create an account, copy a key,
run a command). Never assume I know developer jargon.

Read the file `telegram-dashboard-plan.md` in this folder first — it is the full
spec for what we're building (a dashboard to manage 500+ rented Telegram channels,
with a negotiation → approval workflow, tiered supervisor approval limits, proof
uploads, and lead/deposit conversion tracking).

Tech stack to use (from the plan):
- Frontend: React + Vite + TypeScript + Tailwind CSS + Recharts for charts
- Backend/database/auth: Supabase (Postgres + Auth + Row Level Security + Storage)
- Keep it a single project I can run locally with `npm run dev`

Please build in PHASES, and do NOT move to the next phase until I've tested the
current one and said it works:

PHASE 1 (build this first — the approval workflow, our biggest pain point):
- Project setup (create the Vite + React + Tailwind app, install everything)
- Supabase connection with the database tables from Section 4 of the plan
- Login for team members with roles: admin, supervisor, teammate
- Teammate flow: add a channel, record subscribers/views/likes/channel age,
  record asking price, request a price check, record final negotiated price,
  upload proof screenshots, and submit for approval
- Automatic routing of a submission to the correct supervisor based on the
  negotiated price vs each supervisor's approval limit (see the tiers in the plan)
- Supervisor approval queue: see the channel stats + the full proof trail, then
  approve or reject with a note
- A basic dashboard showing the list of channels and their statuses

For each step:
1. Tell me what you're about to do and why, in one or two plain sentences.
2. Give me any commands to run, and tell me exactly where to paste them.
3. When we need Supabase, walk me through the website click-by-click, tell me
   which keys to copy, and where to paste them (and remind me to keep keys secret).
4. After each chunk, tell me how to see it working in my browser so I can test.

Start by reading the plan and then giving me a short overview of the phases and
the very first step. Then wait for me.
```

---

## Part 5 — Setting up Supabase (Claude walks you through this)

When Claude reaches the database step, it will send you to supabase.com. In plain terms, here's what happens so it's not a surprise:

1. **New project** — you click "New project", give it a name (e.g. `telegram-dashboard`), and set a database password. **Save that password somewhere safe.**
2. **Run the schema** — Claude gives you a block of SQL (the table definitions from the plan). You open Supabase's **SQL Editor**, paste it, and click **Run**. This creates all your tables.
3. **Copy two keys** — Supabase shows a **Project URL** and an **anon key**. Claude tells you to paste these into a file called `.env` in your project. These let your app talk to the database.

> 🔒 **Important:** never share your `.env` file, your database password, or your keys with anyone, and never paste them into a public place. Claude will make sure `.env` is kept out of GitHub automatically.

---

## Part 6 — Running it on your computer & testing (private)

1. Claude will tell you to run `npm run dev` in the VS Code terminal.
2. It shows a link like `http://localhost:5173`. Open it in your browser — that's your app, running privately on your computer.
3. Create a few test users (an admin = you, a supervisor, a teammate) and click through the whole flow: add a channel → price check → upload a proof → submit → approve as supervisor.
4. Anything wrong or ugly? Just tell Claude "this button should do X" or "this looks off" — it will fix it. Repeat until Phase 1 feels right.
5. Then tell Claude: **"Phase 1 works, let's do Phase 2"** (Telegram stats automation), and later Phase 3 (leads/deposits + trending) and Phase 4 (polish).

This is the loop: **run → test → tell Claude what to change → run again.** No pressure — nobody else sees it yet.

---

## Part 7 — Save your work to GitHub (backup)

Do this once the app runs, and again whenever you make progress. Just ask Claude:

> "Please save my work to GitHub — set up the repository and push it, and walk me through any login."

Claude will create the repo and push the code. This is your backup and is required for going live. Your secret `.env` stays out of it automatically.

---

## Part 8 — Going live (only when everything's perfect)

When you and the team are happy testing locally, ask Claude:

> "I'm ready to go live. Walk me through deploying to Vercel and connecting Supabase, step by step."

What happens (Claude guides each click):
1. Vercel connects to your GitHub repo.
2. You paste the same Supabase keys into Vercel's settings.
3. Vercel gives you a public web link (e.g. `your-app.vercel.app`) you can share with teammates and supervisors.
4. Optionally, connect your own domain later.

From then on, every time Claude pushes an update to GitHub, Vercel updates the live site automatically.

---

## Part 9 — Golden rules for working with Claude (since you're not technical)

- **Ask it to explain.** "Explain that like I'm not a developer" always works.
- **One phase at a time.** Don't let it build everything at once — test as you go.
- **When something breaks,** copy the red error text and paste it to Claude. That's exactly what it needs.
- **Keep secrets secret.** Database passwords and keys go in `.env` only, never in chat with anyone else, never in a screenshot you post publicly.
- **Save often.** Ask Claude to push to GitHub after each good milestone.
- **You're in charge.** Nothing goes public until you say "go live."

---

## Quick reference — the order of everything

1. Create GitHub, Supabase, Vercel accounts (Part 1)
2. Install Node, Git, VS Code, Claude extension (Part 2)
3. Make the project folder, drop both .md files in, open in VS Code (Part 3)
4. Paste the big prompt into Claude (Part 4)
5. Claude builds Phase 1; set up Supabase when asked (Part 5)
6. Run locally, test, refine with Claude (Part 6)
7. Push to GitHub to back up (Part 7)
8. Continue phases 2–4, testing each
9. When perfect → go live on Vercel (Part 8)
