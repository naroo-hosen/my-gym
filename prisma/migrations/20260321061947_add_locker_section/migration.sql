-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LockerSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lockerNumber" INTEGER NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'A',
    "memberId" INTEGER,
    "assignedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LockerSlot_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LockerSlot" ("assignedAt", "createdAt", "expiresAt", "id", "lockerNumber", "memberId", "updatedAt") SELECT "assignedAt", "createdAt", "expiresAt", "id", "lockerNumber", "memberId", "updatedAt" FROM "LockerSlot";
DROP TABLE "LockerSlot";
ALTER TABLE "new_LockerSlot" RENAME TO "LockerSlot";
CREATE UNIQUE INDEX "LockerSlot_lockerNumber_key" ON "LockerSlot"("lockerNumber");
CREATE UNIQUE INDEX "LockerSlot_memberId_key" ON "LockerSlot"("memberId");
CREATE INDEX "LockerSlot_memberId_idx" ON "LockerSlot"("memberId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
