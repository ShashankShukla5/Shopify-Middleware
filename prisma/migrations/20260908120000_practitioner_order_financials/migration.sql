-- Reset prior financial tables if they exist from the first schema pass.
DROP TABLE IF EXISTS "PaymentEvent" CASCADE;
DROP TABLE IF EXISTS "OrderItem" CASCADE;
DROP TABLE IF EXISTS "Order" CASCADE;
DROP TABLE IF EXISTS "Practitioner" CASCADE;
DROP TABLE IF EXISTS "PractitionerOrderItem" CASCADE;
DROP TABLE IF EXISTS "PractitionerOrder" CASCADE;

DROP TYPE IF EXISTS "PaymentStatus" CASCADE;
DROP TYPE IF EXISTS "InvoiceRecipientType" CASCADE;
DROP TYPE IF EXISTS "PractitionerStatus" CASCADE;

CREATE TYPE "PractitionerStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "InvoiceRecipientType" AS ENUM ('CLIENT', 'PRACTITIONER');
CREATE TYPE "PaymentStatus" AS ENUM (
  'DRAFT',
  'INVOICE_SENT',
  'PENDING',
  'AUTHORIZED',
  'PARTIALLY_PAID',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'VOIDED',
  'CANCELLED'
);

CREATE TABLE "Practitioner" (
    "id" TEXT NOT NULL,
    "shopifyCustomerId" TEXT NOT NULL,
    "shopifyCustomerGid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT,
    "status" "PractitionerStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Practitioner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "practitionerId" TEXT NOT NULL,
    "shopifyDraftOrderId" TEXT NOT NULL,
    "shopifyDraftOrderName" TEXT,
    "shopifyOrderId" TEXT,
    "shopifyOrderName" TEXT,
    "clientEmail" TEXT,
    "invoiceRecipientEmail" TEXT,
    "invoiceRecipientType" "InvoiceRecipientType",
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "baseTotal" DECIMAL(12,2) NOT NULL,
    "markupTotal" DECIMAL(12,2) NOT NULL,
    "finalTotal" DECIMAL(12,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceSent" BOOLEAN NOT NULL DEFAULT false,
    "invoiceSentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cartToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "shopifyProductId" TEXT,
    "productTitle" TEXT,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "priceSource" TEXT,
    "baseUnitPrice" DECIMAL(12,2) NOT NULL,
    "markupPerUnit" DECIMAL(12,2) NOT NULL,
    "markupTotal" DECIMAL(12,2) NOT NULL,
    "finalUnitPrice" DECIMAL(12,2) NOT NULL,
    "finalLineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "PaymentStatus",
    "toStatus" "PaymentStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Practitioner_shopifyCustomerId_key" ON "Practitioner"("shopifyCustomerId");
CREATE UNIQUE INDEX "Practitioner_shopifyCustomerGid_key" ON "Practitioner"("shopifyCustomerGid");
CREATE INDEX "Practitioner_email_idx" ON "Practitioner"("email");
CREATE INDEX "Practitioner_status_idx" ON "Practitioner"("status");

CREATE UNIQUE INDEX "Order_shopifyDraftOrderId_key" ON "Order"("shopifyDraftOrderId");
CREATE UNIQUE INDEX "Order_shopifyOrderId_key" ON "Order"("shopifyOrderId");
CREATE INDEX "Order_practitionerId_createdAt_idx" ON "Order"("practitionerId", "createdAt");
CREATE INDEX "Order_practitionerId_paymentStatus_idx" ON "Order"("practitionerId", "paymentStatus");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
CREATE INDEX "Order_clientEmail_idx" ON "Order"("clientEmail");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_shopifyVariantId_idx" ON "OrderItem"("shopifyVariantId");

CREATE INDEX "PaymentEvent_orderId_createdAt_idx" ON "PaymentEvent"("orderId", "createdAt");

ALTER TABLE "Order" ADD CONSTRAINT "Order_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
