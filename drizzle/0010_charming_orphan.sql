ALTER TABLE "recurring_streams" ADD COLUMN "is_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recurring_stream_id" uuid;--> statement-breakpoint
CREATE INDEX "transactions_recurring_stream_idx" ON "transactions" USING btree ("recurring_stream_id");