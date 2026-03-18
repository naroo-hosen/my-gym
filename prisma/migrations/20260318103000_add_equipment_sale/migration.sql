CREATE TABLE "EquipmentSale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "soldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentSale_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EquipmentSale_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "EquipmentSale_memberId_soldAt_idx" ON "EquipmentSale"("memberId", "soldAt");
CREATE INDEX "EquipmentSale_equipmentId_soldAt_idx" ON "EquipmentSale"("equipmentId", "soldAt");
