import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type LockerSlotResponse = {
  lockerNumber: number;
  section: string;
  memberId: number | null;
  memberName: string | null;
  memberBirthDate: string | null;
  assignedAt: string | null;
  expiresAt: string | null;
};

type LockerSectionConfig = {
  key: string;
  start: number;
  count: number;
};

const LOCKER_SECTIONS: LockerSectionConfig[] = [
  { key: "A", start: 1, count: 48 },
  { key: "B", start: 49, count: 18 },
  { key: "C", start: 67, count: 40 },
];

const MAX_LOCKERS = LOCKER_SECTIONS.reduce(
  (total, section) => total + section.count,
  0,
);

const getLockerSection = (lockerNumber: number) => {
  const section = LOCKER_SECTIONS.find(
    (slot) =>
      lockerNumber >= slot.start && lockerNumber < slot.start + slot.count,
  );
  return section ?? null;
};

const toDateInputValue = (value: Date | null) => {
  if (!value) {
    return null;
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInput = (raw: string | undefined) => {
  const value = raw?.trim();
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toLockerSlotResponse = (locker: {
  lockerNumber: number;
  section: string;
  memberId: number | null;
  assignedAt: Date | null;
  expiresAt: Date | null;
  member: { id: number; name: string; birthDate: Date | null } | null;
}): LockerSlotResponse => ({
  lockerNumber: locker.lockerNumber,
  section: locker.section,
  memberId: locker.memberId,
  memberName: locker.member?.name ?? null,
  memberBirthDate: toDateInputValue(locker.member?.birthDate ?? null),
  assignedAt: toDateInputValue(locker.assignedAt),
  expiresAt: toDateInputValue(locker.expiresAt),
});

export const GET = async () => {
  const lockers = await prisma.lockerSlot.findMany({
    orderBy: { lockerNumber: "asc" },
    include: {
      member: {
        select: {
          id: true,
          name: true,
          birthDate: true,
        },
      },
    },
  });

  const assigned = new Map(lockers.map((locker) => [locker.lockerNumber, locker]));
  const payload: LockerSlotResponse[] = Array.from(
    { length: MAX_LOCKERS },
    (_, index) => {
      const lockerNumber = index + 1;
      const locker = assigned.get(lockerNumber);
      const section = getLockerSection(lockerNumber)?.key ?? "A";

      if (!locker) {
        return {
          lockerNumber,
          section,
          memberId: null,
          memberName: null,
          memberBirthDate: null,
          assignedAt: null,
          expiresAt: null,
        };
      }

      return toLockerSlotResponse(locker);
    },
  );

  return NextResponse.json(payload);
};

export const POST = async (request: Request) => {
  let body: {
    lockerNumber?: number;
    memberId?: number;
    startDate?: string;
    endDate?: string;
  } | null = null;

  try {
    body = (await request.json()) as {
      lockerNumber?: number;
      memberId?: number;
      startDate?: string;
      endDate?: string;
    };
  } catch (error) {
    return NextResponse.json({ message: "invalid_json" }, { status: 400 });
  }

  const lockerNumber = Number(body?.lockerNumber);
  const memberId = Number(body?.memberId);
  const assignedAt = parseDateInput(body?.startDate?.toString());
  const expiresAt = parseDateInput(body?.endDate?.toString());
  const section = getLockerSection(lockerNumber)?.key ?? null;

  if (!lockerNumber || lockerNumber < 1 || lockerNumber > MAX_LOCKERS) {
    return NextResponse.json(
      { message: "invalid_locker_number" },
      { status: 400 },
    );
  }
  if (!memberId || Number.isNaN(memberId)) {
    return NextResponse.json({ message: "invalid_member" }, { status: 400 });
  }
  if (!assignedAt || !expiresAt) {
    return NextResponse.json({ message: "invalid_date" }, { status: 400 });
  }
  if (expiresAt < assignedAt) {
    return NextResponse.json(
      { message: "invalid_date_range" },
      { status: 400 },
    );
  }

  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      status: {
        not: "DELETE",
      },
    },
    select: {
      id: true,
      name: true,
      birthDate: true,
    },
  });
  if (!member) {
    return NextResponse.json({ message: "member_not_found" }, { status: 404 });
  }

  const slot = await prisma.$transaction(async (transaction) => {
    return transaction.lockerSlot.upsert({
      where: {
        lockerNumber,
      },
      create: {
        lockerNumber,
        section: section ?? "C",
        memberId,
        assignedAt,
        expiresAt,
      },
      update: {
        section: section ?? "C",
        memberId,
        assignedAt,
        expiresAt,
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            birthDate: true,
          },
        },
      },
    });
  });

  return NextResponse.json(toLockerSlotResponse(slot));
};

export const DELETE = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const lockerNumber = Number(searchParams.get("lockerNumber"));
  const section = getLockerSection(lockerNumber)?.key ?? null;

  if (!lockerNumber || lockerNumber < 1 || lockerNumber > MAX_LOCKERS) {
    return NextResponse.json(
      { message: "invalid_locker_number" },
      { status: 400 },
    );
  }

  const slot = await prisma.lockerSlot.upsert({
    where: { lockerNumber },
    create: {
      lockerNumber,
      section: section ?? "C",
      assignedAt: null,
      expiresAt: null,
    },
    update: {
      memberId: null,
      assignedAt: null,
      expiresAt: null,
    },
    include: {
      member: {
        select: {
          id: true,
          name: true,
          birthDate: true,
        },
      },
    },
  });

  return NextResponse.json(toLockerSlotResponse(slot));
};
