import { NextResponse } from "next/server";

import { checkInMemberById, uncheckAttendanceMemberByDate } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";

type CheckInRequestBody = {
  phone?: string;
  date?: string;
  action?: "check" | "uncheck";
};

type MembershipDurationUnit = "MONTH" | "DAY";

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

const parseAttendanceDate = (rawDate?: string) => {
  const normalized = rawDate?.trim();
  if (!normalized) {
    return new Date();
  }

  const matchedDateOnly = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchedDateOnly) {
    const [, year, month, day] = matchedDateOnly;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      0,
      0,
      0,
      0,
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getWeeklyAttendanceCount = async (
  memberId: number,
  targetDate: Date,
  assignedAt?: Date | null,
) => {
  const { start, end } = getWeekRange(targetDate);
  const weekStart = assignedAt && assignedAt > start ? assignedAt : start;

  return prisma.memberActivity.count({
    where: {
      memberId,
      type: "attendance_checked",
      createdAt: {
        gte: weekStart,
        lt: end,
      },
    },
  });
};

const buildCorsHeaders = (request: Request) => {
  const originHeader = request.headers.get("origin");
  const origin = originHeader ?? "*";
  const requestedHeaders =
    request.headers.get("access-control-request-headers") ?? "Content-Type";
  const requestPrivateNetwork =
    request.headers.get("access-control-request-private-network") === "true";
  return {
    "Access-Control-Allow-Origin":
      originHeader === "null" ? "null" : origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": requestedHeaders,
    ...(requestPrivateNetwork
      ? { "Access-Control-Allow-Private-Network": "true" }
      : {}),
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
};

export const OPTIONS = async (request: Request) =>
  new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  });

export const POST = async (request: Request) => {
  const corsHeaders = buildCorsHeaders(request);
  let body: CheckInRequestBody | null = null;

  try {
    body = (await request.json()) as CheckInRequestBody;
  } catch (error) {
    return NextResponse.json(
      { status: "invalid" },
      { status: 400, headers: corsHeaders },
    );
  }

  const rawPhone = body?.phone?.toString().trim();
  if (!rawPhone) {
    return NextResponse.json(
      { status: "invalid" },
      { status: 400, headers: corsHeaders },
    );
  }

  const action = body?.action === "uncheck" ? "uncheck" : "check";
  const attendanceDate = parseAttendanceDate(body?.date);
  if (!attendanceDate) {
    return NextResponse.json(
      { status: "invalid", message: "날짜 형식이 올바르지 않습니다." },
      { status: 400, headers: corsHeaders },
    );
  }
  attendanceDate.setHours(0, 0, 0, 0);

  const digitsOnly = rawPhone.replace(/\D/g, "");
  const formattedPhone =
    digitsOnly.length === 11
      ? `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 7)}-${digitsOnly.slice(7)}`
      : digitsOnly.length === 10
        ? `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`
        : rawPhone;
  const phoneCandidates = Array.from(
    new Set([rawPhone, digitsOnly, formattedPhone].filter(Boolean)),
  );

  const member = await prisma.member.findFirst({
    where: {
      phone: {
        in: phoneCandidates,
      },
      status: {
        not: "DELETE",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      phone: true,
    },
  });

  if (!member) {
    return NextResponse.json(
      { status: "not_found", message: "회원을 찾을 수 없습니다" },
      { status: 404, headers: corsHeaders },
    );
  }

  const memberMembership = await prisma.memberMembership.findUnique({
    where: { memberId: member.id },
    include: {
      membership: true,
      member: {
        select: { status: true },
      },
    },
  });

  const baseCountPromise = getWeeklyAttendanceCount(
    member.id,
    attendanceDate,
    memberMembership?.assignedAt,
  );

  const statusMessageMap: Record<string, string> = {
    ok: "출석체크가 완료되었습니다.",
    already_checked: "오늘은 이미 출석체크를 완료했습니다.",
    limit: "이번 주 출석 가능 횟수를 초과했습니다.",
    expired: "회원권이 만료되었습니다.",
    invalid: "요청할 수 없습니다.",
    not_checked: "해당 날짜에 출석 기록이 없습니다.",
    canceled: "출석체크가 취소되었습니다.",
    no_membership: "회원권이 없습니다",
  };

  if (action === "check") {
    if (
      !memberMembership ||
      memberMembership.member.status === "DELETE" ||
      !memberMembership.membership ||
      memberMembership.membership.status === "DELETE" ||
      memberMembership.pausedAt
    ) {
      return NextResponse.json(
        {
          status: "no_membership",
          message: statusMessageMap.no_membership,
          member,
          summary: null,
        },
        { status: 200, headers: corsHeaders },
      );
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
    const attendanceDateOnly = new Date(attendanceDate);
    attendanceDateOnly.setHours(0, 0, 0, 0);
    const expiryDateOnly = expiryDate ? new Date(expiryDate) : null;
    if (expiryDateOnly) {
      expiryDateOnly.setHours(0, 0, 0, 0);
    }
    const daysRemaining =
      expiryDateOnly && expiryDateOnly >= attendanceDateOnly
        ? Math.ceil((expiryDateOnly.getTime() - attendanceDateOnly.getTime()) / 86400000)
        : 0;

    const result = await checkInMemberById(prisma, member.id, attendanceDate);
    const baseCount = await baseCountPromise;
    let weeklyAttendanceCount = baseCount;
    if (result.status === "ok") {
      weeklyAttendanceCount += 1;
    }

    return NextResponse.json(
      {
        status: result.status,
        message: statusMessageMap[result.status] ?? "출석체크가 불가능합니다.",
        member,
        summary: {
          daysRemaining,
          weeklyAttendanceCount,
          weeklyAttendanceLimit: memberMembership.membership?.weeklyAttendance ?? 0,
        },
      },
      { headers: corsHeaders },
    );
  }

  const result = await uncheckAttendanceMemberByDate(
    prisma,
    member.id,
    attendanceDate,
  );
  const baseCount = await baseCountPromise;
  const weeklyAttendanceCount = Math.max(
    baseCount + (result.status === "canceled" ? -1 : 0),
    0,
  );

  return NextResponse.json(
    {
      status: result.status,
      message: statusMessageMap[result.status] ?? "요청할 수 없습니다.",
      member,
      summary: {
        daysRemaining: 0,
        weeklyAttendanceCount,
        weeklyAttendanceLimit: memberMembership?.membership?.weeklyAttendance ?? 0,
      },
    },
    { headers: corsHeaders },
  );
};
