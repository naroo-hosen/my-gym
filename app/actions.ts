"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type MemberActivityPayload = {
  memberId: number;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
};

type MembershipDurationUnit = "MONTH" | "DAY";

const formatMembershipDuration = (
  duration: number,
  unit: MembershipDurationUnit,
) => `${duration}${unit === "DAY" ? "일" : "개월"}`;

const formatMembershipLabel = (membership: {
  duration: number;
  durationUnit: MembershipDurationUnit;
  weeklyAttendance: number;
  price: number;
}) =>
  `${formatMembershipDuration(membership.duration, membership.durationUnit)} · 주 ${
    membership.weeklyAttendance
  }회 · ${membership.price.toLocaleString("ko-KR")}원`;

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

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

const createMemberActivity = async (
  transaction: PrismaClientLike,
  payload: MemberActivityPayload,
) =>
  transaction.memberActivity.create({
    data: {
      memberId: payload.memberId,
      type: payload.type,
      description: payload.description,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
    },
  });

export const createMember = async (formData: FormData) => {
  const name = formData.get("name")?.toString().trim();
  const phone = formData.get("phone")?.toString().trim();
  const birthDateValue = formData.get("birthDate")?.toString().trim();
  const gender = formData.get("gender")?.toString().trim();
  const parentPhone = formData.get("parentPhone")?.toString().trim();
  const memo = formData.get("memo")?.toString().trim();

  if (!name || !phone) {
    return;
  }

  const member = await prisma.member.create({
    data: {
      name,
      phone,
      birthDate: birthDateValue ? new Date(birthDateValue) : null,
      gender: gender || null,
      parentPhone: parentPhone || null,
      memo: memo || null,
    },
  });

  await createMemberActivity(prisma, {
    memberId: member.id,
    type: "member_created",
    description: "회원 등록",
  });

  revalidatePath("/");
};

export const updateMember = async (formData: FormData) => {
  const id = Number(formData.get("id"));
  const rawName = formData.get("name");
  const rawPhone = formData.get("phone");
  const rawBirthDate = formData.get("birthDate");
  const rawGender = formData.get("gender");
  const rawParentPhone = formData.get("parentPhone");
  const rawMemo = formData.get("memo");
  const rawMembershipId = formData.get("membershipId");

  if (!id) {
    return;
  }

  const data: {
    name?: string;
    phone?: string;
    birthDate?: Date | null;
    gender?: string | null;
    parentPhone?: string | null;
    memo?: string | null;
  } = {};

  if (rawName !== null) {
    const name = rawName.toString().trim();
    if (!name) {
      return;
    }
    data.name = name;
  }

  if (rawPhone !== null) {
    const phone = rawPhone.toString().trim();
    if (!phone) {
      return;
    }
    data.phone = phone;
  }

  if (rawBirthDate !== null) {
    const birthDateValue = rawBirthDate.toString().trim();
    data.birthDate = birthDateValue ? new Date(birthDateValue) : null;
  }

  if (rawGender !== null) {
    const genderValue = rawGender.toString().trim();
    data.gender = genderValue ? genderValue : null;
  }

  if (rawParentPhone !== null) {
    const parentPhoneValue = rawParentPhone.toString().trim();
    data.parentPhone = parentPhoneValue ? parentPhoneValue : null;
  }

  if (rawMemo !== null) {
    const memoValue = rawMemo.toString().trim();
    data.memo = memoValue ? memoValue : null;
  }

  let membershipSelection:
    | { type: "clear" }
    | { type: "assign"; membershipId: number }
    | null = null;
  if (rawMembershipId !== null) {
    const membershipValue = rawMembershipId.toString().trim();
    if (!membershipValue || membershipValue === "none") {
      membershipSelection = { type: "clear" };
    } else {
      const membershipId = Number(membershipValue);
      if (membershipId) {
        membershipSelection = { type: "assign", membershipId };
      }
    }
  }

  if (Object.keys(data).length === 0 && membershipSelection === null) {
    return;
  }

  let membershipDuration: number | null = null;
  let membershipDurationUnit: MembershipDurationUnit | null = null;
  let selectedMembership:
    | {
        id: number;
        duration: number;
        durationUnit: MembershipDurationUnit;
        weeklyAttendance: number;
        price: number;
      }
    | null = null;
  if (membershipSelection?.type === "assign") {
    const membership = await prisma.membership.findFirst({
      where: {
        id: membershipSelection.membershipId,
        status: {
          not: "DELETE",
        },
      },
      select: {
        id: true,
        duration: true,
        durationUnit: true,
        weeklyAttendance: true,
        price: true,
      },
    });
    if (!membership) {
      return;
    }
    membershipDuration = membership.duration;
    membershipDurationUnit =
      membership.durationUnit === "DAY" ? "DAY" : "MONTH";
    selectedMembership = membership;
  }

  await prisma.$transaction(async (transaction) => {
    const existingMembership = await transaction.memberMembership.findUnique({
      where: { memberId: id },
      select: {
        membershipId: true,
      },
    });
    if (Object.keys(data).length > 0) {
      await transaction.member.update({
        where: { id },
        data,
      });
    }

    if (membershipSelection?.type === "clear") {
      if (existingMembership?.membershipId) {
        const previousMembership = await transaction.membership.findUnique({
          where: { id: existingMembership.membershipId },
          select: {
            duration: true,
            durationUnit: true,
            weeklyAttendance: true,
            price: true,
          },
        });
        await transaction.memberMembership.deleteMany({
          where: { memberId: id },
        });
        await createMemberActivity(transaction, {
          memberId: id,
          type: "membership_revoked",
          description: previousMembership
            ? `회원권 회수 (${formatMembershipLabel(previousMembership)})`
            : "회원권 회수",
          metadata: previousMembership
            ? {
                membershipId: existingMembership.membershipId,
                duration: previousMembership.duration,
                durationUnit: previousMembership.durationUnit,
                weeklyAttendance: previousMembership.weeklyAttendance,
                price: previousMembership.price,
              }
            : undefined,
        });
      }
    }

    if (
      membershipSelection?.type === "assign" &&
      membershipDuration &&
      membershipDurationUnit
    ) {
      const assignedAt = new Date();
      const expiresAt = getMembershipExpiryDate(
        assignedAt,
        membershipDuration,
        membershipDurationUnit,
      );
      await transaction.memberMembership.upsert({
        where: { memberId: id },
        update: {
          membershipId: membershipSelection.membershipId,
          assignedAt,
          expiresAt,
          pausedAt: null,
          pauseEndsAt: null,
          totalPausedMs: 0,
        },
        create: {
          memberId: id,
          membershipId: membershipSelection.membershipId,
          assignedAt,
          expiresAt,
        },
      });
      if (selectedMembership) {
        const description =
          existingMembership?.membershipId &&
          existingMembership.membershipId !== selectedMembership.id
            ? `회원권 변경 (${formatMembershipLabel(selectedMembership)})`
            : `회원권 부여 (${formatMembershipLabel(selectedMembership)})`;
        await createMemberActivity(transaction, {
          memberId: id,
          type: "membership_assigned",
          description,
          metadata: {
            membershipId: selectedMembership.id,
            duration: selectedMembership.duration,
            durationUnit: selectedMembership.durationUnit,
            weeklyAttendance: selectedMembership.weeklyAttendance,
            price: selectedMembership.price,
          },
        });
      }
    }
  });

  revalidatePath("/");
};

export const deleteMember = async (formData: FormData) => {
  const id = Number(formData.get("id"));

  if (!id) {
    return;
  }

  await prisma.member.update({
    where: { id },
    data: {
      status: "DELETE",
    },
  });

  await createMemberActivity(prisma, {
    memberId: id,
    type: "member_deactivated",
    description: "회원 중지",
  });

  revalidatePath("/");
};

export const restoreMember = async (formData: FormData) => {
  const id = Number(formData.get("id"));

  if (!id) {
    return;
  }

  await prisma.member.update({
    where: { id },
    data: {
      status: "ACTIVE",
    },
  });

  await createMemberActivity(prisma, {
    memberId: id,
    type: "member_restored",
    description: "회원 복구",
  });

  revalidatePath("/");
};

export const pauseMemberMembership = async (formData: FormData) => {
  const memberId = Number(formData.get("memberId"));
  const pauseEndsAtValue = formData.get("pauseEndsAt")?.toString().trim();

  if (!memberId) {
    return;
  }

  const memberMembership = await prisma.memberMembership.findUnique({
    where: { memberId },
    select: { pausedAt: true },
  });

  if (!memberMembership || memberMembership.pausedAt) {
    return;
  }

  const pauseEndsAt = pauseEndsAtValue
    ? new Date(`${pauseEndsAtValue}T00:00:00`)
    : null;
  if (pauseEndsAt && Number.isNaN(pauseEndsAt.getTime())) {
    return;
  }

  await prisma.memberMembership.update({
    where: { memberId },
    data: { pausedAt: new Date(), pauseEndsAt },
  });

  await createMemberActivity(prisma, {
    memberId,
    type: "membership_paused",
    description: "회원권 일시정지",
  });

  revalidatePath("/");
};

export const resumeMemberMembership = async (formData: FormData) => {
  const memberId = Number(formData.get("memberId"));

  if (!memberId) {
    return;
  }

  const memberMembership = await prisma.memberMembership.findUnique({
    where: { memberId },
    select: {
      pausedAt: true,
      totalPausedMs: true,
      expiresAt: true,
      assignedAt: true,
      membership: {
        select: { duration: true, durationUnit: true },
      },
    },
  });

  if (!memberMembership?.pausedAt) {
    return;
  }

  const pauseDurationMs =
    Date.now() - memberMembership.pausedAt.getTime();
  const baseExpiry =
    memberMembership.expiresAt ??
    (memberMembership.membership?.duration
      ? getMembershipExpiryDate(
          memberMembership.assignedAt,
          memberMembership.membership.duration,
          memberMembership.membership.durationUnit === "DAY" ? "DAY" : "MONTH",
        )
      : null);
  const nextExpiresAt = baseExpiry
    ? new Date(
        baseExpiry.getTime() +
          memberMembership.totalPausedMs +
          pauseDurationMs,
      )
    : null;

  await prisma.memberMembership.update({
    where: { memberId },
    data: {
      pausedAt: null,
      pauseEndsAt: null,
      totalPausedMs: nextExpiresAt
        ? 0
        : memberMembership.totalPausedMs + pauseDurationMs,
      ...(nextExpiresAt ? { expiresAt: nextExpiresAt } : {}),
    },
  });

  await createMemberActivity(prisma, {
    memberId,
    type: "membership_resumed",
    description: "회원권 일시정지 해제",
    metadata: {
      pausedDurationMs: pauseDurationMs,
    },
  });

  revalidatePath("/");
};

export const extendMemberMembership = async (formData: FormData) => {
  const memberId = Number(formData.get("memberId"));
  const unit = formData.get("unit")?.toString();
  const amount = Number(formData.get("amount"));

  if (
    !memberId ||
    !unit ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    !["month", "week", "day"].includes(unit)
  ) {
    return;
  }

  const memberMembership = await prisma.memberMembership.findUnique({
    where: { memberId },
    select: {
      expiresAt: true,
      assignedAt: true,
      membership: { select: { duration: true, durationUnit: true } },
    },
  });

  if (!memberMembership) {
    return;
  }

  const baseExpiry =
    memberMembership.expiresAt ??
    (memberMembership.membership?.duration
      ? getMembershipExpiryDate(
          memberMembership.assignedAt,
          memberMembership.membership.duration,
          memberMembership.membership.durationUnit === "DAY" ? "DAY" : "MONTH",
        )
      : null);

  if (!baseExpiry) {
    return;
  }

  const nextExpiry = new Date(baseExpiry);
  if (unit === "month") {
    nextExpiry.setMonth(nextExpiry.getMonth() + amount);
  } else if (unit === "week") {
    nextExpiry.setDate(nextExpiry.getDate() + amount * 7);
  } else {
    nextExpiry.setDate(nextExpiry.getDate() + amount);
  }

  await prisma.memberMembership.update({
    where: { memberId },
    data: {
      expiresAt: nextExpiry,
    },
  });

  await createMemberActivity(prisma, {
    memberId,
    type: "membership_extended",
    description: `회원권 만료일 연장 (${amount}${
      unit === "month" ? "개월" : unit === "week" ? "주" : "일"
    })`,
    metadata: {
      unit,
      amount,
      previousExpiry: baseExpiry.toISOString(),
      nextExpiry: nextExpiry.toISOString(),
    },
  });

  revalidatePath("/");
};

export const createMembership = async (formData: FormData) => {
  const duration = Number(formData.get("duration"));
  const rawDurationUnit = formData.get("durationUnit")?.toString();
  const durationUnit =
    rawDurationUnit === "DAY" || rawDurationUnit === "MONTH"
      ? rawDurationUnit
      : "MONTH";
  const weeklyAttendance = Number(formData.get("weeklyAttendance"));
  const price = Number(formData.get("price"));

  if (
    !Number.isInteger(duration) ||
    duration <= 0 ||
    Number.isNaN(weeklyAttendance) ||
    Number.isNaN(price)
  ) {
    return;
  }

  await prisma.membership.create({
    data: {
      duration,
      durationUnit,
      weeklyAttendance,
      price,
    },
  });

  revalidatePath("/");
};

export const deleteMembership = async (formData: FormData) => {
  const id = Number(formData.get("id"));

  if (!id) {
    return;
  }

  await prisma.membership.update({
    where: { id },
    data: {
      status: "DELETE",
    },
  });

  revalidatePath("/");
};

export const restoreMembership = async (formData: FormData) => {
  const id = Number(formData.get("id"));

  if (!id) {
    return;
  }

  await prisma.membership.update({
    where: { id },
    data: {
      status: "ACTIVE",
    },
  });

  revalidatePath("/");
};
