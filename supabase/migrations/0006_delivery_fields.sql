-- Manual delivery payloads and top-up context live on the order item.
alter table order_items add column if not exists delivery_payload_encrypted text;
alter table order_items add column if not exists delivery_note text;
alter table order_items add column if not exists delivered_by uuid references profiles(id) on delete set null;
create index if not exists order_items_fulfillment_idx on order_items(fulfillment_status, created_at);
