-- AlterTable
ALTER TABLE "events" ADD COLUMN     "expected_cash" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "settled_by_id" UUID,
ADD COLUMN     "settled_event_id" UUID;

-- CreateIndex
CREATE INDEX "orders_settled_event_id_idx" ON "orders"("settled_event_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_settled_event_id_fkey" FOREIGN KEY ("settled_event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_settled_by_id_fkey" FOREIGN KEY ("settled_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Regras que o Prisma não expressa
-- Quitação só existe para "pagar depois" e é feita em Pix ou dinheiro (RF-12, RF-16).
ALTER TABLE "orders" ADD CONSTRAINT "orders_settlement_consistent" CHECK (
  "settled_with" IS NULL OR ("payment_method" = 'PAY_LATER' AND "settled_with" IN ('PIX', 'CASH'))
);
ALTER TABLE "events" ADD CONSTRAINT "events_cash_non_negative" CHECK (
  ("expected_cash" IS NULL OR "expected_cash" >= 0) AND ("counted_cash" IS NULL OR "counted_cash" >= 0)
);
