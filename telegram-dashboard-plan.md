# Telegram Channels Dashboard — Planning & Build Spec

**Owner:** Manish (manish@nexora.live)
**Status:** Planning (build later in VS Code with Claude)
**Scale:** 500+ channels · 10–15 team members · role-based access · fully detailed per-post tracking

---

## 1. Goal

Replace the current mess of many Google Sheets with a single dashboard where the team and supervisors can monitor channel activity and performance across the whole portfolio — subscriber growth, post activity, engagement, and collaboration deals/revenue.

**Business model context:** This is a channel brokerage/rental operation. Channels are **rented from external owners**, and the team's job is to pitch clients the **best channel for their budget**. So the dashboard must also track, per channel: who the external owner is, our rental cost, the audience/niche (for matching), and the price we charge clients — enabling margin (client price − rental cost) and "best channel for a given budget" recommendations.

---

## 2. The two decisions that shape everything

### 2.1 Data backbone: database, not spreadsheets
At 500+ channels with per-post detail and 10–15 concurrent editors, Google Sheets is not viable (row/cell limits, slow at scale, edit conflicts, no real access control). Use a proper database.

**Recommendation:** **Supabase (hosted PostgreSQL).** It gives you database + authentication + role-based access (row-level security) + auto-generated API + realtime updates with almost no backend code. Ideal for a small team building with Claude in VS Code.

Existing Google Sheets become a **one-time migration source**, not the live system.

### 2.2 Data collection: automate first, manual only where unavoidable
Manually logging per-post metrics for 500+ channels is unsustainable. Split collection:

| Data | How to collect |
|------|----------------|
| Subscriber count, post views, forwards, reactions, post content | **Automated** via Telegram (Bot API + Telethon/MTProto), scheduled sync |
| Deals, partners, revenue, ad slots, payment status | **Manual entry** (forms in the app) |
| Notes, qualitative flags, channel ownership | **Manual entry** |

This keeps humans doing only what machines can't.

---

## 3. Users & roles

| Role | Who | Can see | Can do |
|------|-----|---------|--------|
| **Supervisor** | Multiple, tiered by approval limit | Full portfolio: channels, subs/views/likes, channel age, negotiated price | **Approve/reject channels up to their spending limit** (see §4a), review stats, export |
| **Admin** | You | Everything | Manage users, set supervisor limits, all edits, export |
| **Teammate** | 10–15 members | The channels they manage/source (rented from external owners) | Source channels, **bargain with vendors and record the negotiated price**, submit for approval, log deals/notes |

Supervisors are **tiered by approval limit** — e.g. Supervisor 1 up to 20k, Supervisor 2 up to 50k, Supervisor 3 up to 100k. A channel's negotiated price routes it to a supervisor whose limit covers that price (see the approval workflow in §4a).

Access enforced at the database level (Supabase row-level security), not just hidden in the UI.

---

## 4. Data model (draft schema)

**channels** — id, name, handle, telegram_id, niche/category, audience/geo, channel_created_date (the channel's own age — a supervisor review criterion), managed_by (→ users, the teammate sourcing it), status (active/paused/archived), created_at

**channel_rentals** (the brokerage terms) — id, channel_id, external_owner_name, external_owner_contact, asking_price (the owner's initial quote), target_price (the max/target you approve before negotiation), negotiated_price (what the teammate bargained the vendor down to), cost_period (per post/day/month), client_price (our rate to buyers), currency, availability, notes — enables margin (client_price − negotiated_price) and "best channel for budget X" matching

**approvals** (the approval workflow) — id, channel_id (or rental_id), submitted_by (→ teammate), asking_price, target_price, negotiated_price, status (draft / price_check / pending / approved / rejected), assigned_supervisor (→ user, routed by price vs limit), decided_by, decided_at, decision_note

**negotiation_proofs** (full evidence trail) — id, approval_id, uploaded_by, stage (first_contact / asking_price / negotiation / final_agreement / payment), file_type (screenshot / screen recording), file_url (→ Supabase Storage), uploaded_at, caption — a **complete timeline of proofs from first contact until the deal is cracked**, not just one file. Supervisors see the entire chain in order when reviewing, so they can trace how the price moved.

**channel_performance** (lead → deposit conversion) — id, channel_id, date/period, leads (leads generated from the channel), deposits (leads that converted to deposits), spend, revenue — powers per-channel conversion tracking and the "hot/trending" ranking

**supervisor_limits** — user_id (→ supervisor), approval_limit (e.g. 20k / 50k / 100k), currency

**users** — id, name, email, role, group

**channel_stats** (automated, one row per channel per sync) — id, channel_id, captured_at, subscribers, subscriber_delta, period

**posts** (automated per-post detail) — id, channel_id, telegram_msg_id, posted_at, type (text/photo/video), views, forwards, reactions_total, reactions_breakdown (json), comments

**deals** (manual) — id, channel_id, partner_name, deal_type (ad/collab/cross-promo), amount, currency, date, status (pending/confirmed/paid), notes

**notes/activity_log** — id, channel_id, user_id, timestamp, note

---

## 4a. Negotiation & approval workflow

This is the core operational flow that replaces the current "update the sheet, supervisor approves in the sheet" process.

**Steps**
1. **Source** — a teammate adds a channel (or picks an available one) and records its stats: subscribers, views, likes, and channel creation date.
2. **Get the asking price** — the teammate asks the channel owner the price and records the owner's **asking price**.
3. **Price check (pre-negotiation)** — the teammate asks you/the admin "is it worth this?" You reply with a **target price** (the max to aim for). This is a lightweight internal go-ahead *before* haggling, separate from the final approval. Status: `price_check`.
4. **Bargain + attach proof** — the teammate negotiates the owner down toward the target and uploads **proof of the negotiation chat** (screenshot or screen recording) to the submission. This replaces posting proof in a group; it stays attached to the record. At least one proof file is required to submit.
5. **Record** — the teammate records the final **negotiated price** and links the proof.
6. **Submit** — teammate submits the channel for approval → status becomes `pending`.
7. **Route by limit** — the system assigns it to a supervisor whose approval limit covers the negotiated price. Example tiers:

   | Negotiated price | Routed to |
   |------------------|-----------|
   | ≤ 20k | Supervisor 1 (limit 20k) |
   | ≤ 50k | Supervisor 2 (limit 50k) |
   | ≤ 100k | Supervisor 3 (limit 100k) |
   | > 100k | Admin / highest tier |

8. **Review & decide** — the assigned supervisor reviews subs, views, likes, channel age, and the attached proof, then **approves or rejects** with an optional note.
9. **Result** — approved channels become active in the portfolio and available in the Channel Finder; rejected ones go back to the teammate with the note.

**Routing rule to confirm:** route to the *lowest* tier that covers the price (so a 15k channel goes to Supervisor 1, not 3). An alternative is "any supervisor with limit ≥ price can approve." Decide which you want (see open questions §9).

**Audit trail:** every submit/approve/reject is logged (who, when, price, note) — something the messy sheets can't reliably give you today.

---

## 5. Metrics / KPI definitions

- **Subscriber growth** — absolute + % change over day/week/month; per channel and portfolio-wide.
- **Post activity** — posts published per period; posting consistency (cadence vs target).
- **Engagement rate** — (reactions + forwards + comments) ÷ views, or ÷ subscribers; per post and averaged.
- **Reach** — total/avg views per post.
- **Revenue** — total and per channel; deals pipeline by status; revenue per 1k subscribers.
- **Margin** — client_price − negotiated_price, per channel and per deal; margin % — the core profitability metric for the brokerage model.
- **Value-for-budget** — reach or engagement per unit cost, used to rank channels when matching a client budget.
- **Leads** — number of leads generated per channel (per day/week/campaign).
- **Deposits (conversions)** — number of leads that converted to deposits, per channel.
- **Conversion rate** — deposits ÷ leads, per channel — the key quality signal for a channel.
- **Cost per lead / cost per deposit** — spend ÷ leads and spend ÷ deposits — shows which channels convert cheaply.
- **Hot/trending** — channels ranked by recent momentum: rising leads/deposits, rising conversion rate, and subscriber growth over the last period.
- **Team performance** — growth & revenue rolled up by channel owner.

---

## 6. Dashboard views

**Supervisor view** — an **approval queue** at the top (channels routed to them by price limit, showing subs/views/likes/channel age/asking vs negotiated price and the **full proof trail** (every screenshot from first contact to final agreement, in order), with approve/reject buttons), plus portfolio KPIs (total subs, growth trend, total revenue), top/bottom performers, deals pipeline, per-teammate performance, filters by niche/owner/date.

**Manager view** — same but scoped to their group of channels.

**Teammate view** — only their channels: submission status (draft/price_check/pending/approved/rejected), a form to record the asking price, request a price check, record the final negotiated price, upload proof (screenshot/screen recording), and submit for approval; rejection notes from supervisors; plus growth chart, post cadence, engagement, and their deals.

**Hot / Trending panel** — a ranked leaderboard of channels with the most momentum right now: highest leads and deposits, best conversion rate, and fastest subscriber growth over the selected period. Lets everyone spot the channels worth pushing (and the ones going cold). Shown on both supervisor and teammate dashboards.

**Channel finder (brokerage core)** — enter a client budget + target niche/audience, get a ranked list of the best-value available channels (best reach/engagement per cost, with margin shown). This is the tool the team uses to pitch clients.

**Shared elements** — search, date-range filter, channel drill-down page (one channel's full history + rental terms), CSV/export.

---

## 7. Suggested tech stack (for the VS Code + Claude build)

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, Recharts (or Chart.js) for graphs.
- **Backend/DB/Auth:** Supabase (Postgres + Auth + row-level security + realtime).
- **Telegram sync service:** Python worker (Telethon for channel/post stats + Bot API), scheduled (cron / Supabase Edge Function / small VPS) writing into `channel_stats` and `posts`.
- **Hosting:** Vercel/Netlify for the frontend; Supabase hosts DB.

All of this is well within what you can build with Claude in VS Code.

---

## 8. Phased build plan

**Phase 0 — Setup**
Create Supabase project, define schema (Section 4), set up auth + roles. Migration is trivial: today's data is just a Google Form dumping **Channel Link** into a protected response sheet, so import those links into `channels` and start capturing the rest fresh. (You can keep a simple form for teammates to submit new channel links — it just needs to feed the database instead of a bare sheet.)

**Phase 1 — MVP (the approval workflow — highest priority)**
Auth/login, channels list, teammate submission form (stats + asking price + price-check request + negotiated price + proof upload), price-based routing to the right supervisor, supervisor approval queue with proof view + approve/reject + audit trail. This directly replaces the current sheet-based approval process and is the biggest immediate win. Include basic subscriber & revenue charts. Prove it with real users.

**Phase 2 — Telegram automation**
Build the Python sync worker: pull subscribers, post views, forwards, reactions on a schedule into the DB. Dashboard now auto-updates.

**Phase 3 — Conversion tracking & trending**
Leads/deposits per channel (synced from your tracker or entered manually), conversion rate, cost per lead/deposit, and the Hot/Trending leaderboard.

**Phase 4 — Depth & polish**
Engagement analytics, posting-consistency tracking, per-channel drill-down, team performance rollups, exports, alerts (e.g. "channel X dropped subscribers" or "conversion rate falling").

---

## 9. Open questions to resolve before building

1. **Telegram access** — are these channels you own/admin? Automated stats (esp. subscriber counts, per-post views) need admin access or a bot in the channel. Which channels can you get API access to?
2. **Revenue currency/multi-currency** — single currency or several? (Matters for margin math across rentals in different currencies.)
7. **Rental terms** — is pricing usually per-post, per-day, or monthly? Do external owners give fixed rates or is it negotiated per deal? This shapes the `channel_rentals` fields.
8. **Approval routing rule** — route to the *lowest* tier that covers the price, or let *any* supervisor with a limit ≥ price approve? What happens when the assigned supervisor is unavailable (escalate up a tier)?
9. **Approval limits** — are 20k/50k/100k the exact tiers, and in what currency? Can limits change per supervisor over time?
10. **Re-approval** — if a teammate renegotiates the price after approval, does it need re-approval (and possibly re-routing to a higher tier)?
11. **Price check** — who does the pre-negotiation price check: always you (admin), or can the routed supervisor also set the target price? Should it be a formal step in the app or an informal heads-up?
12. **Proof format** — screenshots and/or screen recordings? Any max file size / retention period? Should proof be required before the price check too, or only before final submission?
13. **Leads/deposits source** — where does lead & deposit data come from? A tracker/affiliate platform (e.g. Keitaro, Voluum), a CRM, or manual entry? If there's an API/export we can auto-sync it; otherwise it's a manual field. This is the biggest unknown for the conversion metrics.
14. **What counts as a lead vs a deposit** — define both precisely (e.g. lead = signup/click, deposit = first paid deposit) so numbers are consistent across the team.
15. **Trending window** — over what period is "hot/trending" measured (last 7 days? 30?), and weighted by what (deposits, conversion rate, growth)?
3. **Existing sheets** — reviewed: current sheet ("ME AND MANISH") is just a Google Form collecting a **Channel Link** column into protected response tabs. Minimal data → clean-slate build with the links imported. Note: it's owned by manishrao4466@gmail.com, not manish@nexora.live — decide which Google account owns the new system and connectors.
4. **"Manager" role** — do you need a middle tier, or just supervisor + teammate?
5. **Alerts/notifications** — do supervisors want push alerts (email/Telegram) for big changes, or just the dashboard?
6. **History depth** — how far back do you need to import? Fresh start or migrate historical stats?

---

## 10. Next step

When you're ready to build in VS Code, hand this doc to Claude and start with **Phase 0**: set up Supabase and the schema. Confirm the open questions in Section 9 first — especially #1 (Telegram access), since it determines how much can be automated vs. manual.
