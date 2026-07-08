-- New channel-level fields for the expanded Live Deals table: owner name,
-- a shared social link (YouTube or Instagram), an internal reference code,
-- a WhatsApp contact link, previous-deal company/amount, and free-text
-- criteria notes. All manual-entry only — not covered by the Telegram
-- auto-fetch.
alter table public.channels
  add column owner_name text,
  add column social_link text,
  add column channel_code text,
  add column whatsapp_link text,
  add column previous_deal_company text,
  add column previous_deal_amount numeric,
  add column criteria text;
