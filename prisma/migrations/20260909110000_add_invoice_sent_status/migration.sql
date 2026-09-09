-- Add INVOICE_SENT to PaymentStatus enum.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'INVOICE_SENT';
