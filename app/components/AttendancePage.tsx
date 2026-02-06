"use client";

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

const buildRecentDates = (baseDate = new Date(), days = 7) => {
  const dates: Date[] = [];
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday - 7);
  for (let i = 0; i < days; i += 1) {
    const next = new Date(start);
    next.setDate(start.getDate() + i);
    dates.push(next);
  }
  return dates;
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
) => {
  if (!duration || !unit) return "-";
  return `${duration}${unit === "DAY" ? "일" : "개월"}`;
};

const AttendancePage = ({ members }: AttendancePageProps) => {
  const recentDates = buildRecentDates();

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
          <div className="attendance-row attendance-header">
            <div className="attendance-cell">이름</div>
            <div className="attendance-cell">연락처</div>
            <div className="attendance-cell">회원권</div>
            <div className="attendance-cell">회원권 주간횟수</div>
          </div>
          {members.map((member) => (
            <div key={member.id} className="attendance-row">
              <div className="attendance-cell">{member.name}</div>
              <div className="attendance-cell">{member.phone}</div>
              <div className="attendance-cell">
                {formatMembershipDuration(
                  member.membershipDuration,
                  member.membershipDurationUnit,
                )}
              </div>
              <div className="attendance-cell">
                {member.membershipWeeklyAttendance === null
                  ? "-"
                  : `${member.membershipWeeklyAttendance}회`}
              </div>
            </div>
          ))}
        </div>

        <div className="attendance-scroll">
          <div className="attendance-scroll-inner">
            <div className="attendance-row attendance-header attendance-date-row">
              {recentDates.map((date) => (
                <div key={formatDateKey(date)} className="attendance-cell">
                  <div className="attendance-date">{formatDateLabel(date)}</div>
                  <div className="attendance-day">{formatDayLabel(date)}</div>
                </div>
              ))}
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
                  {recentDates.map((date) => {
                    const dateKey = formatDateKey(date);
                    const hasAttendance = attendanceDates.has(dateKey);
                    return (
                      <div
                        key={dateKey}
                        className={`attendance-cell${
                          hasAttendance ? " checked" : ""
                        }`}
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
