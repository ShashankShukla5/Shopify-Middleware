-- Collapse payment status to PENDING | PAID only.

-- Normalize existing Order rows before swapping the enum type.
UPDATE "Order"
SET "paymentStatus" = CASE
  WHEN "paymentStatus"::text = 'PAID' THEN 'PAID'::"PaymentStatus"
  ELSE 'PENDING'::"PaymentStatus"
END;

UPDATE "PaymentEvent"
SET "fromStatus" = CASE
  WHEN "fromStatus" IS NULL THEN NULL
  WHEN "fromStatus"::text = 'PAID' THEN 'PAID'::"PaymentStatus"
  ELSE 'PENDING'::"PaymentStatus"
END;

UPDATE "PaymentEvent"
SET "toStatus" = CASE
  WHEN "toStatus"::text = 'PAID' THEN 'PAID'::"PaymentStatus"
  ELSE 'PENDING'::"PaymentStatus"
END;

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
