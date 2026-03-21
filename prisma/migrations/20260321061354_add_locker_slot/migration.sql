-- CreateTable
CREATE TABLE "LockerSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lockerNumber" INTEGER NOT NULL,
    "memberId" INTEGER,
    "assignedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LockerSlot_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LockerSlot_lockerNumber_key" ON "LockerSlot"("lockerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LockerSlot_memberId_key" ON "LockerSlot"("memberId");

-- CreateIndex
CREATE INDEX "LockerSlot_memberId_idx" ON "LockerSlot"("memberId");
