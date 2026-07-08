-- Allow tagging a proof as evidence of a PREVIOUS, separate deal with this
-- channel/owner (uploaded right when a teammate adds the channel), distinct
-- from the negotiation proof trail for the new deal currently being worked.
alter table public.negotiation_proofs drop constraint negotiation_proofs_stage_check;
alter table public.negotiation_proofs add constraint negotiation_proofs_stage_check
  check (stage in ('previous_deal', 'first_contact', 'asking_price', 'negotiation', 'final_agreement', 'payment'));
