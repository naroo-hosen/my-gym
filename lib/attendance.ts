import { Prisma, PrismaClient } from "@prisma/client";

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

type MembershipDurationUnit = "MONTH" | "DAY";

type CheckInStatus =
  | "invalid"
  | "not_started"
  | "expired"
  | "already_checked"
  | "limit"
  | "ok";

type AttendanceToggleStatus = CheckInStatus | "not_checked" | "canceled";

type AttendanceTargetResult = {
  status: AttendanceToggleStatus;
};

type MemberActivityPayload = {
  memberId: number;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

const createMemberActivity = async (
  transaction: PrismaClientLike,
  payload: MemberActivityPayload,
) =>
  transaction.memberActivity.create({
    data: {
      memberId: payload.memberId,
      type: payload.type,
      description: payload.description,
      ...(payload.createdAt ? { createdAt: payload.createdAt } : {}),
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
    },
  });

const getMembershipExpiryDate = (
  assignedAt: Date,
  duration: number,
  durationUnit: MembershipDurationUnit,
) => {
  const expiresAt = new Date(assignedAt);

  if (durationUnit === "DAY") {
    expiresAt.setDate(expiresAt.getDate() + Math.max(duration - 1, 0));
    expiresAt.setHours(23, 59, 59, 999);
    return expiresAt;
  }

  expiresAt.setMonth(expiresAt.getMonth() + duration);
  return expiresAt;
};

const getAdjustedExpiryDate = (memberMembership: {
  assignedAt: Date;
  expiresAt: Date | null;
  totalPausedMs: number;
  membership: { duration: number; durationUnit: MembershipDurationUnit } | null;
}) => {
  const baseExpiry =
    memberMembership.expiresAt ??
    (memberMembership.membership?.duration
      ? getMembershipExpiryDate(
          memberMembership.assignedAt,
          memberMembership.membership.duration,
          memberMembership.membership.durationUnit,
        )
      : null);
  if (!baseExpiry) {
    return null;
  }
  const adjusted = new Date(baseExpiry);
  adjusted.setTime(baseExpiry.getTime() + memberMembership.totalPausedMs);
  return adjusted;
};

const getDayRange = (baseDate = new Date()) => {
  const start = new Date(baseDate);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
};

const getWeekRange = (baseDate = new Date()) => {
  const start = new Date(baseDate);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
};

export const checkInMemberById = async (
  prisma: PrismaClientLike,
  memberId: number,
  targetDate = new Date(),
) => {
  if (!memberId) {
    return { status: "invalid" as CheckInStatus };
  }

  const dayRange = getDayRange(targetDate);
  if (!dayRange) {
    return { status: "invalid" as CheckInStatus };
  }

  const memberMembership = await prisma.memberMembership.findUnique({
    where: { memberId },
    include: {
      membership: true,
      member: {
        select: { status: true },
      },
    },
  });

  if (
    !memberMembership ||
    memberMembership.member.status === "DELETE" ||
    !memberMembership.membership ||
    memberMembership.membership.status === "DELETE" ||
    memberMembership.pausedAt
  ) {
    return { status: "invalid" as CheckInStatus };
  }

  const expiryDate = getAdjustedExpiryDate({
    assignedAt: memberMembership.assignedAt,
    expiresAt: memberMembership.expiresAt,
    totalPausedMs: memberMembership.totalPausedMs,
    membership: memberMembership.membership
      ? {
          duration: memberMembership.membership.duration,
          durationUnit:
            memberMembership.membership.durationUnit === "DAY" ? "DAY" : "MONTH",
        }
      : null,
  });

  if (!expiryDate) {
    return { status: "invalid" as CheckInStatus };
  }

  const today = dayRange.start;
  if (memberMembership.assignedAt > today) {
    return { status: "not_started" as CheckInStatus };
  }
  const expiryDateOnly = new Date(expiryDate);
  expiryDateOnly.setHours(0, 0, 0, 0);

  if (expiryDateOnly < today) {
    return { status: "expired" as CheckInStatus };
  }

  const todayEnd = dayRange.end;
  const todayAttendanceCount = await prisma.memberActivity.count({
    where: {
      memberId,
      type: "attendance_checked",
      createdAt: {
        gte: today,
        lt: todayEnd,
      },
    },
  });

  if (todayAttendanceCount > 0) {
    return { status: "already_checked" as CheckInStatus };
  }

  const { start, end } = getWeekRange(targetDate);
  const latestMembershipAssigned = await prisma.memberActivity.findFirst({
    where: {
      memberId,
      type: "membership_assigned",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
    },
  });
  const assignedAt = latestMembershipAssigned?.createdAt ?? memberMembership.assignedAt;
  const attendanceCount = await prisma.memberActivity.count({
    where: {
      memberId,
      type: "attendance_checked",
      createdAt: {
        gte: assignedAt > start ? assignedAt : start,
        lt: end,
      },
    },
  });

  if (attendanceCount >= memberMembership.membership.weeklyAttendance) {
    return { status: "limit" as CheckInStatus };
  }

  await createMemberActivity(prisma, {
    memberId,
    type: "attendance_checked",
    description: "출석 체크",
    createdAt: dayRange.start,
    metadata: {
      weeklyAttendance: memberMembership.membership.weeklyAttendance,
      attendanceCount: attendanceCount + 1,
    },
  });

  return { status: "ok" as CheckInStatus };
};

export const uncheckAttendanceMemberByDate = async (
  prisma: PrismaClientLike,
  memberId: number,
  targetDate = new Date(),
) => {
  if (!memberId) {
    return { status: "invalid" as AttendanceToggleStatus };
  }

  const dayRange = getDayRange(targetDate);
  if (!dayRange) {
    return { status: "invalid" as AttendanceToggleStatus };
  }

  const existingAttendance = await prisma.memberActivity.findFirst({
    where: {
      memberId,
      type: "attendance_checked",
      createdAt: {
        gte: dayRange.start,
        lt: dayRange.end,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
    },
  });

  if (!existingAttendance) {
    return { status: "not_checked" as AttendanceToggleStatus };
  }

  await prisma.memberActivity.delete({
    where: {
      id: existingAttendance.id,
    },
  });

  return { status: "canceled" as AttendanceToggleStatus };
};
