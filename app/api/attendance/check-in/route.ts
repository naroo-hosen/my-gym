import { NextResponse } from "next/server";

import { checkInMemberById } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";

type CheckInRequestBody = {
  phone?: string;
};

export const POST = async (request: Request) => {
  let body: CheckInRequestBody | null = null;

  try {
    body = (await request.json()) as CheckInRequestBody;
  } catch (error) {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  const phone = body?.phone?.toString().trim();
  if (!phone) {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  const member = await prisma.member.findFirst({
    where: {
      phone,
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
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  const result = await checkInMemberById(prisma, member.id);

  return NextResponse.json({
    status: result.status,
    member,
  });
};
