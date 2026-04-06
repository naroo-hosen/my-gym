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

const getMembershipExpiryDate = (
  assignedAt: Date,
  duration: number,
  durationUnit: string,
) => {
  const nextExpiry = new Date(assignedAt);
  if (durationUnit === "DAY") {
    nextExpiry.setDate(nextExpiry.getDate() + Math.max(duration - 1, 0));
    nextExpiry.setHours(23, 59, 59, 999);
    return nextExpiry;
  }

  const durationMonths = Math.max(0, duration);
  const nextMonth = nextExpiry.getMonth() + durationMonths;
  nextExpiry.setMonth(nextMonth);

  if (nextExpiry.getMonth() !== ((nextMonth % 12) + 12) % 12) {
    nextExpiry.setDate(0);
  }

  return nextExpiry;
};

const createMemberActivity = async (
  transaction: typeof prisma,
  payload: {
    memberId: number;
    type: string;
    description: string;
    metadata?: Record<string, unknown>;
  },
) =>
  transaction.memberActivity.create({
    data: {
      memberId: payload.memberId,
      type: payload.type,
      description: payload.description,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
    },
  });

const resumePausedMemberships = async (now: Date) => {
  const pausedMemberships = await prisma.memberMembership.findMany({
    where: {
      pausedAt: { not: null },
      pauseEndsAt: { not: null, lte: now },
    },
    include: {
      membership: { select: { duration: true, durationUnit: true } },
    },
  });

  if (!pausedMemberships.length) {
    return;
  }

  await prisma.$transaction(
    pausedMemberships.map((memberMembership) => {
      const pausedAt = memberMembership.pausedAt;
      const pauseEndsAt = memberMembership.pauseEndsAt;

      if (!pausedAt || !pauseEndsAt) {
        return prisma.memberMembership.update({
          where: { id: memberMembership.id },
          data: { pausedAt: null, pauseEndsAt: null },
        });
      }

      const pauseDurationMs = Math.max(
        0,
        pauseEndsAt.getTime() - pausedAt.getTime(),
      );
      const baseExpiry =
        memberMembership.expiresAt ??
        (memberMembership.membership?.duration
          ? getMembershipExpiryDate(
              memberMembership.assignedAt,
              memberMembership.membership.duration,
              memberMembership.membership.durationUnit,
            )
          : null);
      const nextExpiresAt = baseExpiry
        ? new Date(
            baseExpiry.getTime() +
              memberMembership.totalPausedMs +
              pauseDurationMs,
          )
        : null;

      return prisma.memberMembership.update({
        where: { id: memberMembership.id },
        data: {
          pausedAt: null,
          pauseEndsAt: null,
          totalPausedMs: nextExpiresAt
            ? 0
            : memberMembership.totalPausedMs + pauseDurationMs,
          ...(nextExpiresAt ? { expiresAt: nextExpiresAt } : {}),
        },
      });
    }),
  );
};

const runMembershipExpiryBatch = async () => {
  const now = new Date();

  await resumePausedMemberships(now);

  const expiredMemberships = await prisma.memberMembership.findMany({
    where: {
      pausedAt: null,
      expiresAt: {
        lt: now,
      },
    },
    include: {
      membership: {
        select: {
          duration: true,
          durationUnit: true,
          weeklyAttendance: true,
          price: true,
        },
      },
    },
  });

  if (!expiredMemberships.length) {
    return;
  }

  await prisma.$transaction(async (transaction) => {
    for (const expiredMembership of expiredMemberships) {
      await createMemberActivity(transaction as typeof prisma, {
        memberId: expiredMembership.memberId,
        type: "membership_expired",
        description: "회원권 만료",
        metadata: {
          membershipId: expiredMembership.membershipId,
          assignedAt: expiredMembership.assignedAt.toISOString(),
          expiredAt: expiredMembership.expiresAt?.toISOString() ?? null,
          duration: expiredMembership.membership?.duration ?? null,
          durationUnit: expiredMembership.membership?.durationUnit ?? null,
          weeklyAttendance: expiredMembership.membership?.weeklyAttendance ?? null,
          price: expiredMembership.membership?.price ?? null,
        },
      });
    }

    await transaction.memberMembership.deleteMany({
      where: {
        id: {
          in: expiredMemberships.map((membership) => membership.id),
        },
      },
    });
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
