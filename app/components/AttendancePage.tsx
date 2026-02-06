"use client";

import { useEffect, useMemo, useRef } from "react";

type AttendanceActivity = {
  createdAt: string;
};

type AttendanceMember = {
  id: number;
  name: string;
  phone: string;
  membershipDuration: number | null;
  membershipDurationUnit: "MONTH" | "DAY" | null;
  membershipWeeklyAttendance: number | null;
  membershipAssignedAt: string | null;
  activities: AttendanceActivity[];
};

type AttendancePageProps = {
  members: AttendanceMember[];
};

const buildWeekRanges = (baseDate = new Date()) => {
  const today = new Date(baseDate);
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  const diffToMonday = (day + 6) % 7;
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - diffToMonday);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekDates: Date[] = [];
  const thisWeekDates: Date[] = [];

  for (let i = 0; i < 7; i += 1) {
    const last = new Date(lastWeekStart);
    last.setDate(lastWeekStart.getDate() + i);
    lastWeekDates.push(last);

    const current = new Date(thisWeekStart);
    current.setDate(thisWeekStart.getDate() + i);
    thisWeekDates.push(current);
  }

  return { lastWeekDates, thisWeekDates };
};

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  });

const formatDayLabel = (date: Date) =>
  date.toLocaleDateString("ko-KR", { weekday: "short" });

const formatMembershipDuration = (
  duration: number | null,
  unit: "MONTH" | "DAY" | null,
  weeklyAttendance: number | null,
) => {
  if (!duration || !unit) return "-";
  const durationLabel = `${duration}${unit === "DAY" ? "일" : "개월"}`;
  if (weeklyAttendance === null) {
    return durationLabel;
  }
  return `${durationLabel} (${weeklyAttendance}회)`;
};

const AttendancePage = ({ members }: AttendancePageProps) => {
  const { lastWeekDates, thisWeekDates } = buildWeekRanges();
  const todayKey = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return formatDateKey(today);
  }, []);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const todayCellRef = useRef<HTMLDivElement | null>(null);
  const lastWeekLabel =
    lastWeekDates.length > 0
      ? `${formatDateLabel(lastWeekDates[0])} ~ ${formatDateLabel(
          lastWeekDates[lastWeekDates.length - 1],
        )}`
      : "";
  const thisWeekLabel =
    thisWeekDates.length > 0
      ? `${formatDateLabel(thisWeekDates[0])} ~ ${formatDateLabel(
          thisWeekDates[thisWeekDates.length - 1],
        )}`
      : "";
  const allDates = [...lastWeekDates, ...thisWeekDates];

  useEffect(() => {
    if (!scrollContainerRef.current || !todayCellRef.current) {
      return;
    }
    const container = scrollContainerRef.current;
    const cell = todayCellRef.current;
    const cellCenter = cell.offsetLeft + cell.offsetWidth / 2;
    const targetLeft = Math.max(0, cellCenter - container.clientWidth / 2);
    container.scrollTo({ left: targetLeft, behavior: "smooth" });
  }, []);

  return (
    <section className="panel list-panel">
      <div className="list-panel-actions">
        <div>
          <h2 className="section-title">출석 현황</h2>
          <p className="section-subtitle">
            회원권 보유 및 일시정지 상태가 아닌 회원의 최근 1주일 출석 기록을
            확인합니다.
          </p>
        </div>
      </div>

      <div className="attendance-table">
        <div className="attendance-fixed">
          <div className="attendance-row attendance-header attendance-week-spacer">
            <div className="attendance-cell attendance-week-spacer-cell">
              주간 구간
            </div>
          </div>
          <div className="attendance-row attendance-header">
            <div className="attendance-cell">이름</div>
            <div className="attendance-cell">연락처</div>
            <div className="attendance-cell">회원권</div>
          </div>
          {members.map((member) => (
            <div key={member.id} className="attendance-row">
              <div className="attendance-cell">{member.name}</div>
              <div className="attendance-cell">{member.phone}</div>
              <div className="attendance-cell">
                {formatMembershipDuration(
                  member.membershipDuration,
                  member.membershipDurationUnit,
                  member.membershipWeeklyAttendance,
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="attendance-scroll" ref={scrollContainerRef}>
          <div className="attendance-scroll-inner">
            <div className="attendance-row attendance-header attendance-date-row attendance-week-row">
              <div className="attendance-cell attendance-week-cell">
                지난주 ({lastWeekLabel})
              </div>
              <div className="attendance-cell attendance-week-cell is-current">
                이번주 ({thisWeekLabel})
              </div>
            </div>
            <div className="attendance-row attendance-header attendance-date-row">
              {lastWeekDates.map((date) => {
                const dateKey = formatDateKey(date);
                return (
                  <div
                    key={dateKey}
                    className="attendance-cell"
                    ref={dateKey === todayKey ? todayCellRef : undefined}
                  >
                    <div className="attendance-date">
                      {formatDateLabel(date)}
                    </div>
                    <div className="attendance-day">{formatDayLabel(date)}</div>
                  </div>
                );
              })}
              {thisWeekDates.map((date) => {
                const dateKey = formatDateKey(date);
                return (
                  <div
                    key={dateKey}
                    className="attendance-cell is-current-week"
                    ref={dateKey === todayKey ? todayCellRef : undefined}
                  >
                    <div className="attendance-date">
                      {formatDateLabel(date)}
                    </div>
                    <div className="attendance-day">{formatDayLabel(date)}</div>
                  </div>
                );
              })}
            </div>
            {members.map((member) => {
              const attendanceDates = new Set(
                member.activities.map((activity) => {
                  const activityDate = new Date(activity.createdAt);
                  activityDate.setHours(0, 0, 0, 0);
                  return formatDateKey(activityDate);
                }),
              );

              return (
                <div
                  key={member.id}
                  className="attendance-row attendance-date-row"
                >
                  {allDates.map((date, index) => {
                    const dateKey = formatDateKey(date);
                    const hasAttendance = attendanceDates.has(dateKey);
                    const isCurrentWeek = index >= lastWeekDates.length;
                    return (
                      <div
                        key={dateKey}
                        className={`attendance-cell${
                          hasAttendance ? " checked" : ""
                        }${isCurrentWeek ? " is-current-week" : ""}`}
                      >
                        {hasAttendance ? "✔︎" : "-"}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AttendancePage;
