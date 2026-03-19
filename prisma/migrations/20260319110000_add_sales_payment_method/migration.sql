ALTER TABLE "SalesEntry" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT '계좌이체';
ALTER TABLE "SalesEntry" ADD COLUMN "installmentMonths" INTEGER;
