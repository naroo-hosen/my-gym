-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EquipmentSale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "soldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentSale_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EquipmentSale_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EquipmentSale" ("equipmentId", "id", "memberId", "paymentMethod", "price", "soldAt") SELECT "equipmentId", "id", "memberId", "paymentMethod", "price", "soldAt" FROM "EquipmentSale";
DROP TABLE "EquipmentSale";
ALTER TABLE "new_EquipmentSale" RENAME TO "EquipmentSale";
CREATE INDEX "EquipmentSale_memberId_soldAt_idx" ON "EquipmentSale"("memberId", "soldAt");
CREATE INDEX "EquipmentSale_equipmentId_soldAt_idx" ON "EquipmentSale"("equipmentId", "soldAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
