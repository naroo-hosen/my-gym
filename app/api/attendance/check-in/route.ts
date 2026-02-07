import { NextResponse } from "next/server";

import { checkInMemberById } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";

type CheckInRequestBody = {
  phone?: string;
};

const buildCorsHeaders = (request: Request) => {
  const origin = request.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
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

  const phone = body?.phone?.toString().trim();
  if (!phone) {
    return NextResponse.json(
      { status: "invalid" },
      { status: 400, headers: corsHeaders },
    );
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
    return NextResponse.json(
      { status: "not_found" },
      { status: 404, headers: corsHeaders },
    );
  }

  const result = await checkInMemberById(prisma, member.id);

  return NextResponse.json(
    {
      status: result.status,
      member,
    },
    { headers: corsHeaders },
  );
};
