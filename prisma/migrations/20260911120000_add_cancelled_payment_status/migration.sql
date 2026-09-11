-- Allow cancelled / deleted draft orders in payment status.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
