-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_id" UUID;

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "name_key" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_name_key_key" ON "customers"("name_key");

-- CreateIndex
CREATE INDEX "orders_customer_id_payment_status_idx" ON "orders"("customer_id", "payment_status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: uma conta por nome (mesma normalização de src/lib/customer.ts) para os fiados existentes.
CREATE TEMP TABLE "_fiado_keys" AS
SELECT "id" AS "order_id",
       regexp_replace(btrim("customer_name"), '\s+', ' ', 'g') AS "name",
       lower(regexp_replace(btrim(translate("customer_name",
         'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
         'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g')) AS "name_key",
       "created_at"
FROM "orders"
WHERE "payment_method" = 'PAY_LATER';

INSERT INTO "customers" ("id", "name", "name_key", "created_at")
SELECT DISTINCT ON ("name_key") gen_random_uuid(), "name", "name_key", "created_at"
FROM "_fiado_keys"
ORDER BY "name_key", "created_at";

UPDATE "orders" o
SET "customer_id" = c."id"
FROM "_fiado_keys" k
JOIN "customers" c ON c."name_key" = k."name_key"
WHERE o."id" = k."order_id";

DROP TABLE "_fiado_keys";

-- Todo fiado pertence a uma conta.
ALTER TABLE "orders" ADD CONSTRAINT "orders_pay_later_has_customer"
  CHECK ("payment_method" <> 'PAY_LATER' OR "customer_id" IS NOT NULL);
