import { NextResponse } from "next/server";

import { checkInMemberById } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";

type CheckInRequestBody = {
  phone?: string;
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
    ...(requestPrivateNetwork ? { "Access-Control-Allow-Private-Network": "true" } : {}),
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
      { status: "not_found", message: "회원 정보를 찾을 수 없습니다." },
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
        message: "회원권이 없습니다.",
        member,
      },
      { status: 200, headers: corsHeaders },
    );
  }

  const result = await checkInMemberById(prisma, member.id);
  const statusMessageMap: Record<string, string> = {
    ok: "출석체크가 완료되었습니다.",
    already_checked: "오늘은 이미 출석체크를 완료했습니다.",
    limit: "이번 주 출석 가능 횟수를 초과했습니다.",
    expired: "회원권이 만료되었습니다.",
    invalid: "출석체크가 불가능합니다.",
  };

  return NextResponse.json(
    {
      status: result.status,
      message: statusMessageMap[result.status] ?? "출석체크가 불가능합니다.",
      member,
    },
    { headers: corsHeaders },
  );
};
