PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_SalesEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "installmentMonths" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_SalesEntry" (
    "id",
    "type",
    "date",
    "amount",
    "title",
    "description",
    "paymentMethod",
    "installmentMonths",
    "createdAt"
)
SELECT
    "id",
    "type",
    "date",
    "amount",
    "title",
    "description",
    NULL,
    "installmentMonths",
    "createdAt"
FROM "SalesEntry";

DROP TABLE "SalesEntry";
ALTER TABLE "new_SalesEntry" RENAME TO "SalesEntry";
CREATE INDEX "SalesEntry_date_type_idx" ON "SalesEntry"("date", "type");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
