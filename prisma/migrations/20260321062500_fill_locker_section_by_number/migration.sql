UPDATE "LockerSlot"
SET "section" = CASE
    WHEN "lockerNumber" >= 49 THEN 'B'
    ELSE 'A'
  END;
