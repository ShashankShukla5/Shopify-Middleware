-- paymentStatus is PENDING | PAID only.
-- Invoice delivery stays on Order.invoiceSent (boolean).

-- Preserve invoice flag for any rows that used INVOICE_SENT as status.
UPDATE "Order"
SET
  "invoiceSent" = true,
  "invoiceSentAt" = COALESCE("invoiceSentAt", CURRENT_TIMESTAMP),
  "paymentStatus" = 'PENDING'
WHERE "paymentStatus"::text = 'INVOICE_SENT';

UPDATE "PaymentEvent"
SET "fromStatus" = 'PENDING'
WHERE "fromStatus"::text = 'INVOICE_SENT';

UPDATE "PaymentEvent"
SET "toStatus" = 'PENDING'
WHERE "toStatus"::text = 'INVOICE_SENT';

CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'PAID');

ALTER TABLE "Order"
  ALTER COLUMN "paymentStatus" DROP DEFAULT;

ALTER TABLE "Order"
  ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new"
  USING (
    CASE
      WHEN "paymentStatus"::text = 'PAID' THEN 'PAID'::"PaymentStatus_new"
      ELSE 'PENDING'::"PaymentStatus_new"
    END
  );

ALTER TABLE "PaymentEvent"
  ALTER COLUMN "fromStatus" TYPE "PaymentStatus_new"
  USING (
    CASE
      WHEN "fromStatus" IS NULL THEN NULL
      WHEN "fromStatus"::text = 'PAID' THEN 'PAID'::"PaymentStatus_new"
      ELSE 'PENDING'::"PaymentStatus_new"
    END
  );

ALTER TABLE "PaymentEvent"
  ALTER COLUMN "toStatus" TYPE "PaymentStatus_new"
  USING (
    CASE
      WHEN "toStatus"::text = 'PAID' THEN 'PAID'::"PaymentStatus_new"
      ELSE 'PENDING'::"PaymentStatus_new"
    END
  );

DROP TYPE "PaymentStatus";

ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";

ALTER TABLE "Order"
  ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING'::"PaymentStatus";
