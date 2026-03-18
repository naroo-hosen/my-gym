"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkInMemberById } from "@/lib/attendance";

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
    const normalizedDurationUnit: MembershipDurationUnit =
      membership.durationUnit === "DAY" ? "DAY" : "MONTH";
    membershipDurationUnit = normalizedDurationUnit;
    selectedMembership = {
      ...membership,
      durationUnit: normalizedDurationUnit,
    };
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
        const normalizedPreviousMembership:
            | {
          duration: number;
          durationUnit: MembershipDurationUnit;
          weeklyAttendance: number;
          price: number;
        }
            | null = previousMembership
            ? {
              ...previousMembership,
              durationUnit:
                  previousMembership.durationUnit === "DAY" ? "DAY" : "MONTH",
            }
            : null;
        await transaction.memberMembership.deleteMany({
          where: { memberId: id },
        });
        await createMemberActivity(transaction, {
          memberId: id,
          type: "membership_revoked",
          description: normalizedPreviousMembership
              ? `회원권 회수 (${formatMembershipLabel(normalizedPreviousMembership)})`
            : "회원권 회수",
          metadata: normalizedPreviousMembership
            ? {
                membershipId: existingMembership.membershipId,
                duration: normalizedPreviousMembership.duration,
                durationUnit: normalizedPreviousMembership.durationUnit,
                weeklyAttendance: normalizedPreviousMembership.weeklyAttendance,
                price: normalizedPreviousMembership.price,
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

export const permanentlyDeleteMember = async (formData: FormData) => {
  const id = Number(formData.get("id"));

  if (!id) {
    return;
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.memberActivity.deleteMany({
      where: { memberId: id },
    });
    await transaction.equipmentSale.deleteMany({
      where: { memberId: id },
    });
    await transaction.memberMembership.deleteMany({
      where: { memberId: id },
    });
    await transaction.member.delete({
      where: { id },
    });
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
  const targetDate = formData.get("targetDate")?.toString().trim();
  const isIncrementUnit = (value: string | undefined): value is "month" | "week" | "day" =>
    value === "month" || value === "week" || value === "day";

  const hasTargetDate = Boolean(targetDate);
  const hasIncrementalInput =
    isIncrementUnit(unit) &&
    Number.isInteger(amount) &&
    amount > 0;

  if (!memberId || (!hasTargetDate && !hasIncrementalInput)) {
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

  const resolvedNextExpiry = targetDate
    ? new Date(`${targetDate}T23:59:59`)
    : baseExpiry
      ? new Date(baseExpiry)
      : null;

  if (!resolvedNextExpiry || Number.isNaN(resolvedNextExpiry.getTime())) {
    return;
  }

  if (!targetDate) {
    if (!isIncrementUnit(unit)) {
      return;
    }
    if (unit === "month") {
      resolvedNextExpiry.setMonth(resolvedNextExpiry.getMonth() + amount);
    } else if (unit === "week") {
      resolvedNextExpiry.setDate(resolvedNextExpiry.getDate() + amount * 7);
    } else {
      resolvedNextExpiry.setDate(resolvedNextExpiry.getDate() + amount);
    }
  }

  await prisma.memberMembership.update({
    where: { memberId },
    data: {
      expiresAt: resolvedNextExpiry,
    },
  });

  await createMemberActivity(prisma, {
    memberId,
    type: "membership_extended",
    description: hasTargetDate
      ? "회원권 만료일 변경"
      : `회원권 만료일 연장 (${amount}${
          unit === "month" ? "개월" : unit === "week" ? "주" : "일"
        })`,
    metadata: {
      mode: hasTargetDate ? "absolute" : "incremental",
      previousExpiry: baseExpiry ? baseExpiry.toISOString() : null,
      nextExpiry: resolvedNextExpiry.toISOString(),
      ...(hasTargetDate
        ? {}
        : {
            unit: unit as "month" | "week" | "day",
            amount,
          }),
    },
  });

  revalidatePath("/");
};

export const checkInMember = async (formData: FormData) => {
  const memberId = Number(formData.get("memberId"));

  if (!memberId) {
    return { status: "invalid" as const };
  }

  const result = await checkInMemberById(prisma, memberId);
  if (result.status === "ok") {
    revalidatePath("/");
  }
  return result;
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
    return { status: "invalid" as const };
  }

  const linkedMemberCount = await prisma.memberMembership.count({
    where: { membershipId: id },
  });

  if (linkedMemberCount > 0) {
    return {
      status: "has_members" as const,
      linkedMemberCount,
    };
  }

  await prisma.membership.update({
    where: { id },
    data: {
      status: "DELETE",
    },
  });

  revalidatePath("/");
  return { status: "ok" as const };
};

export const permanentlyDeleteMembership = async (formData: FormData) => {
  const id = Number(formData.get("id"));

  if (!id) {
    return { status: "invalid" as const };
  }

  const linkedMemberCount = await prisma.memberMembership.count({
    where: { membershipId: id },
  });

  if (linkedMemberCount > 0) {
    return {
      status: "has_members" as const,
      linkedMemberCount,
    };
  }

  await prisma.membership.delete({
    where: { id },
  });

  revalidatePath("/");
  return { status: "ok" as const };
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

export const createEquipment = async (formData: FormData) => {
  const name = formData.get("name")?.toString().trim();
  const price = Number(formData.get("price"));

  if (!name || Number.isNaN(price) || price < 0) {
    return { status: "invalid" as const };
  }

  await prisma.equipment.create({
    data: {
      name,
      price,
    },
  });

  revalidatePath("/");
  return { status: "success" as const };
};

export const updateEquipment = async (formData: FormData) => {
  const id = Number(formData.get("id"));
  const name = formData.get("name")?.toString().trim();
  const price = Number(formData.get("price"));

  if (!id || !name || Number.isNaN(price) || price < 0) {
    return { status: "invalid" as const };
  }

  await prisma.equipment.update({
    where: { id },
    data: {
      name,
      price,
    },
  });

  revalidatePath("/");
  return { status: "success" as const };
};

export const deleteEquipment = async (formData: FormData) => {
  const id = Number(formData.get("id"));

  if (!id) {
    return { status: "invalid" as const };
  }

  await prisma.equipment.update({
    where: { id },
    data: {
      status: "DELETE",
    },
  });

  revalidatePath("/");
  return { status: "success" as const };
};

export const restoreEquipment = async (formData: FormData) => {
  const id = Number(formData.get("id"));

  if (!id) {
    return { status: "invalid" as const };
  }

  await prisma.equipment.update({
    where: { id },
    data: {
      status: "ACTIVE",
    },
  });

  revalidatePath("/");
  return { status: "success" as const };
};

export const createEquipmentSale = async (formData: FormData) => {
  const memberId = Number(formData.get("memberId"));
  const equipmentId = Number(formData.get("equipmentId"));
  const paymentMethod = formData.get("paymentMethod")?.toString().trim();

  if (!memberId || !equipmentId || !paymentMethod) {
    return { status: "invalid" as const };
  }

  const [member, equipment] = await Promise.all([
    prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        name: true,
        status: true,
      },
    }),
    prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        status: {
          not: "DELETE",
        },
      },
      select: {
        id: true,
        name: true,
        price: true,
      },
    }),
  ]);

  if (!member || member.status === "DELETE" || !equipment) {
    return { status: "invalid" as const };
  }

  await prisma.$transaction(async (transaction) => {
    const sale = await transaction.equipmentSale.create({
      data: {
        memberId,
        equipmentId,
        price: equipment.price,
        paymentMethod,
      },
    });

    await transaction.salesEntry.create({
      data: {
        type: "income",
        date: new Date(),
        amount: equipment.price,
        title: `${member.name} ${equipment.name} 판매`,
        description: paymentMethod,
      },
    });

    await createMemberActivity(transaction, {
      memberId,
      type: "equipment_sold",
      description: `장비 판매 (${equipment.name})`,
      metadata: {
        equipmentSaleId: sale.id,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        price: equipment.price,
        paymentMethod,
      },
    });
  });

  revalidatePath("/");
  return { status: "success" as const };
};

export const deleteEquipmentSale = async (formData: FormData) => {
  const equipmentSaleId = Number(formData.get("equipmentSaleId"));

  if (!equipmentSaleId) {
    return { status: "invalid" as const };
  }

  const sale = await prisma.equipmentSale.findUnique({
    where: { id: equipmentSaleId },
    include: {
      member: {
        select: {
          id: true,
          name: true,
        },
      },
      equipment: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!sale) {
    return { status: "invalid" as const };
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.equipmentSale.delete({
      where: { id: equipmentSaleId },
    });

    await transaction.salesEntry.create({
      data: {
        type: "expense",
        date: new Date(),
        amount: sale.price,
        title: `${sale.member.name} ${sale.equipment.name} 판매 취소`,
        description: sale.paymentMethod,
      },
    });

    await createMemberActivity(transaction, {
      memberId: sale.member.id,
      type: "equipment_sale_deleted",
      description: `장비 판매 취소 (${sale.equipment.name})`,
      metadata: {
        equipmentSaleId,
        equipmentId: sale.equipment.id,
        equipmentName: sale.equipment.name,
        price: sale.price,
        paymentMethod: sale.paymentMethod,
      },
    });
  });

  revalidatePath("/");
  return { status: "success" as const };
};
