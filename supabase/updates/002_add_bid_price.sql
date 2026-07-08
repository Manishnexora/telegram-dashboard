-- "Bid price" is the opening counter-offer a supervisor/admin tells the teammate
-- to start negotiating from — distinct from "target price" (the max cap not to
-- exceed) and "negotiated price" (the evolving/final number from back-and-forth).
alter table public.approvals add column bid_price numeric;
