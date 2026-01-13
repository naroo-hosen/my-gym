import "server-only";

import { prisma } from "@/lib/prisma";

declare global {
  // eslint-disable-next-line no-var
  var membershipExpiryBatchInitialized: boolean | undefined;
}

const TARGET_TIMEZONE = "Asia/Seoul";

const getTimePartsInZone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = getTimePartsInZone(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
};

const makeDateInTimeZone = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);

  return new Date(utcGuess - offset);
};

const runMembershipExpiryBatch = async () => {
  const now = new Date();

  await prisma.memberMembership.deleteMany({
    where: {
      pausedAt: null,
      expiresAt: {
        lt: now,
      },
    },
  });
};

const scheduleNextBatch = () => {
  const now = new Date();
  const parts = getTimePartsInZone(now, TARGET_TIMEZONE);
  let nextRun = makeDateInTimeZone(
    parts.year,
    parts.month,
    parts.day,
    0,
    10,
    TARGET_TIMEZONE,
  );

  if (nextRun <= now) {
    nextRun = makeDateInTimeZone(
      parts.year,
      parts.month,
      parts.day + 1,
      0,
      10,
      TARGET_TIMEZONE,
    );
  }

  const delayMs = Math.max(0, nextRun.getTime() - now.getTime());

  setTimeout(async () => {
    await runMembershipExpiryBatch();
    scheduleNextBatch();
  }, delayMs);
};

export const ensureMembershipExpiryBatch = () => {
  if (globalThis.membershipExpiryBatchInitialized) {
    return;
  }

  globalThis.membershipExpiryBatchInitialized = true;

  scheduleNextBatch();
};
