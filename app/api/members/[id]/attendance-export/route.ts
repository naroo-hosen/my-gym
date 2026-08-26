import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    id: string;
  };
};

type AttendanceExportActivity = {
  createdAt: Date;
};

const toDateOnly = (value: string | null) => {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, rawYear, rawMonth, rawDay] = match;
  const parsed = new Date(
    Number(rawYear),
    Number(rawMonth) - 1,
    Number(rawDay),
    0,
    0,
    0,
    0,
  );

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const escapeHtml = (value: string | number | null | undefined) => {
  const normalized = value === null || value === undefined ? "" : String(value);
  return normalized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const sanitizeFilename = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const formatDate = (date: Date) =>
  date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  });

const formatTime = (date: Date) =>
  date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Seoul",
  });

const formatDateTime = (date: Date) =>
  date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Seoul",
  });

export const GET = async (_request: Request, context: RouteContext) => {
  const memberId = Number(context.params.id);
  if (Number.isNaN(memberId) || memberId <= 0) {
    return NextResponse.json({ error: "잘못된 회원 ID입니다." }, { status: 400 });
  }

  const { searchParams } = new URL(_request.url);
  const fromParam = searchParams.get("start");
  const toParam = searchParams.get("end");

  const fromDate = toDateOnly(fromParam);
  const toDate = toDateOnly(toParam);

  if (toParam && !toDate) {
    return NextResponse.json(
      { error: "종료일 형식이 잘못되었습니다." },
      { status: 400 },
    );
  }
  if (fromParam && !fromDate) {
    return NextResponse.json(
      { error: "시작일 형식이 잘못되었습니다." },
      { status: 400 },
    );
  }
  if (fromDate && toDate && fromDate > toDate) {
    return NextResponse.json(
      { error: "시작일은 종료일보다 늦을 수 없습니다." },
      { status: 400 },
    );
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      phone: true,
      birthDate: true,
      activities: {
        where: {
          type: "attendance_checked",
          ...(fromDate || toDate
            ? {
                createdAt: {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate
                    ? {
                        lt: (() => {
                          const nextDay = new Date(toDate);
                          nextDay.setDate(nextDay.getDate() + 1);
                          return nextDay;
                        })(),
                      }
                    : {}),
                },
              }
            : {}),
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          createdAt: true,
        },
      },
    },
  });

  if (!member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const birthDateText = member.birthDate
    ? member.birthDate.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Seoul",
      })
    : "-";

  const issuedAt = new Date();
  const issuedDateText = formatDateTime(issuedAt);
  const periodText = `${fromDate ? formatDate(fromDate) : "전체"} ~ ${
    toDate ? formatDate(toDate) : "현재"
  }`;

  const rowList = member.activities
    .map((activity: AttendanceExportActivity) => {
      const createdAt = new Date(activity.createdAt);
      return `<tr>
        <td>${escapeHtml(member.name)}</td>
        <td>${escapeHtml(birthDateText)}</td>
        <td>${escapeHtml(member.phone)}</td>
        <td>${escapeHtml(formatDate(createdAt))}</td>
        <td>${escapeHtml(formatTime(createdAt))}</td>
      </tr>`;
    })
    .join("");

  const rows =
    member.activities.length === 0
      ? `<tr>
        <td colspan="5" class="empty">해당 기간 내 출석 기록이 없습니다.</td>
      </tr>`
      : rowList;

  const style = `
    <style>
      table { border-collapse: collapse; width: 100%; }
      th, td {
        border: 1px solid #222;
        padding: 8px 10px;
        font-size: 10.5pt;
      }
      th {
        background: #e8efff;
        color: #1e3a8a;
        text-align: center;
        font-weight: 700;
      }
      .title {
        font-size: 18px;
        font-weight: 800;
        text-align: center;
        background: #dbeafe;
        height: 30px;
      }
      .sub-title {
        background: #f8fafc;
        font-weight: 700;
        text-align: center;
      }
      .meta {
        background: #f8fafc;
        font-size: 10pt;
      }
      .meta-label {
        font-weight: 700;
        background: #f1f5f9;
        width: 14%;
      }
      .section {
        font-weight: 700;
        background: #eff6ff;
        text-align: left;
      }
      .empty {
        text-align: center;
        color: #64748b;
        font-style: italic;
      }
      .signature {
        background: #f8fafc;
        height: 45px;
      }
      .note {
        font-size: 9.5pt;
        color: #334155;
      }
    </style>
  `;

  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        ${style}
      </head>
      <body style="font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif; color: #0f172a;">
        <table>
          <tr>
            <td colspan="5" class="title">PBL Boxing Center 출석 증빙용 확인서</td>
          </tr>
          <tr>
            <td colspan="5" class="sub-title">출석이력 증빙 자료</td>
          </tr>
          <tr>
            <td class="meta-label">발급일시</td>
            <td class="meta" colspan="2">${escapeHtml(issuedDateText)}</td>
            <td class="meta-label">조회 기간</td>
            <td class="meta">${escapeHtml(periodText)}</td>
          </tr>
          <tr>
            <td class="section" colspan="5">회원 정보</td>
          </tr>
          <tr>
            <td class="meta-label">회원명</td>
            <td class="meta">${escapeHtml(member.name)}</td>
            <td class="meta-label">회원번호</td>
            <td class="meta" colspan="2">${escapeHtml(member.id)}</td>
          </tr>
          <tr>
            <td class="meta-label">생년월일</td>
            <td class="meta">${escapeHtml(birthDateText)}</td>
            <td class="meta-label">전화번호</td>
            <td class="meta" colspan="2">${escapeHtml(member.phone)}</td>
          </tr>
          <tr>
            <td class="section" colspan="5">출석 내역</td>
          </tr>
          <tr>
            <th>이름</th>
            <th>생년월일</th>
            <th>전화번호</th>
            <th>출석일</th>
            <th>출석시간</th>
          </tr>
          ${rows}
          <tr>
            <td class="signature" colspan="2">담당자</td>
            <td class="signature" colspan="3">직인/서명</td>
          </tr>
          <tr>
            <td colspan="5" class="note">본 증빙은 PBL Boxing Center 회원 출석 기록 시스템에서 자동 발급되었으며, 출석 내역 확인 목적으로 사용됩니다.</td>
          </tr>
        </table>
      </body>
    </html>
  `.trim();

  const nowLabel = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filenameSafeName = sanitizeFilename(member.name) || `member_${member.id}`;
  const filename = `attendance_certificate_${filenameSafeName}_${nowLabel}.xls`;
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(`\uFEFF${html}`, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
    },
  });
};
