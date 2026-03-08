"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

const formatDateValue = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("ko-KR");
};

const AttendancePage = ({ members }: AttendancePageProps) => {
  const { lastWeekDates, thisWeekDates } = buildWeekRanges();
  const todayKey = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return formatDateKey(today);
  }, []);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const thisWeekStartRef = useRef<HTMLDivElement | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
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
  const allDates = [...thisWeekDates, ...lastWeekDates];
  const attendanceByDate = useMemo(() => {
    const map = new Map<string, number>();
    allDates.forEach((date) => {
      map.set(formatDateKey(date), 0);
    });

    members.forEach((member) => {
      const memberAttendance = new Set(
        member.activities.map((activity) => {
          const activityDate = new Date(activity.createdAt);
          activityDate.setHours(0, 0, 0, 0);
          return formatDateKey(activityDate);
        }),
      );

      memberAttendance.forEach((dateKey) => {
        map.set(dateKey, (map.get(dateKey) ?? 0) + 1);
      });
    });

    return map;
  }, [allDates, members]);
  const attendanceSummary = useMemo(() => {
    const totalMembers = members.length;
    const thisWeekKeys = new Set(
      thisWeekDates.map((date) => formatDateKey(date)),
    );
    let todayCount = 0;
    let thisWeekCount = 0;

    members.forEach((member) => {
      const attendanceDates = new Set(
        member.activities.map((activity) => {
          const activityDate = new Date(activity.createdAt);
          activityDate.setHours(0, 0, 0, 0);
          return formatDateKey(activityDate);
        }),
      );

      if (attendanceDates.has(todayKey)) {
        todayCount += 1;
      }

      const hasThisWeekAttendance = Array.from(thisWeekKeys).some((key) =>
        attendanceDates.has(key),
      );
      if (hasThisWeekAttendance) {
        thisWeekCount += 1;
      }
    });

    const todayRate = totalMembers
      ? Math.round((todayCount / totalMembers) * 100)
      : 0;
    const thisWeekRate = totalMembers
      ? Math.round((thisWeekCount / totalMembers) * 100)
      : 0;
    const absentCount = totalMembers - todayCount;

    return {
      totalMembers,
      todayCount,
      todayRate,
      thisWeekCount,
      thisWeekRate,
      absentCount,
    };
  }, [members, thisWeekDates, todayKey]);
  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );
  const selectedMemberAttendance = useMemo(() => {
    if (!selectedMember) return null;
    const attendanceDates = selectedMember.activities.map((activity) => {
      const activityDate = new Date(activity.createdAt);
      activityDate.setHours(0, 0, 0, 0);
      return formatDateKey(activityDate);
    });
    const attendanceSet = new Set(attendanceDates);
    const thisWeekAttendanceCount = thisWeekDates.reduce((count, date) => {
      const key = formatDateKey(date);
      return attendanceSet.has(key) ? count + 1 : count;
    }, 0);
    const latestAttendance = selectedMember.activities.reduce<string | null>(
      (latest, activity) => {
        if (!latest) return activity.createdAt;
        return new Date(activity.createdAt) > new Date(latest)
          ? activity.createdAt
          : latest;
      },
      null,
    );

    return {
      todayAttendance: attendanceSet.has(todayKey),
      thisWeekAttendanceCount,
      latestAttendance,
    };
  }, [selectedMember, thisWeekDates, todayKey]);

  useEffect(() => {
    if (!scrollContainerRef.current) {
      return;
    }
    const container = scrollContainerRef.current;
    container.scrollTo({ left: 0, behavior: "auto" });
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

      <div className="attendance-summary">
        <div className="attendance-summary-card">
          <div className="attendance-summary-header">
            <span className="attendance-summary-title">오늘 출석자 수</span>
            <span className="attendance-summary-value">
              {attendanceSummary.todayCount}명
            </span>
          </div>
          <div className="attendance-summary-bar">
            <div
              className="attendance-summary-bar-fill"
              style={{ width: `${attendanceSummary.todayRate}%` }}
            />
          </div>
          <p className="attendance-summary-meta">
            출석률 {attendanceSummary.todayRate}%
          </p>
        </div>
        <div className="attendance-summary-card">
          <div className="attendance-summary-header">
            <span className="attendance-summary-title">출석률</span>
            <span className="attendance-summary-value">
              {attendanceSummary.todayRate}%
            </span>
          </div>
          <div className="attendance-summary-bar">
            <div
              className="attendance-summary-bar-fill is-accent"
              style={{ width: `${attendanceSummary.todayRate}%` }}
            />
          </div>
          <p className="attendance-summary-meta">
            오늘 출석자 {attendanceSummary.todayCount} /{" "}
            {attendanceSummary.totalMembers}
          </p>
        </div>
        <div className="attendance-summary-card">
          <div className="attendance-summary-header">
            <span className="attendance-summary-title">주간 출석률</span>
            <span className="attendance-summary-value">
              {attendanceSummary.thisWeekRate}%
            </span>
          </div>
          <div className="attendance-summary-bar">
            <div
              className="attendance-summary-bar-fill is-weekly"
              style={{ width: `${attendanceSummary.thisWeekRate}%` }}
            />
          </div>
          <p className="attendance-summary-meta">
            이번주 출석자 {attendanceSummary.thisWeekCount} /{" "}
            {attendanceSummary.totalMembers}
          </p>
        </div>
        <div className="attendance-summary-card">
          <div className="attendance-summary-header">
            <span className="attendance-summary-title">미출석자 수</span>
            <span className="attendance-summary-value">
              {attendanceSummary.absentCount}명
            </span>
          </div>
          <div className="attendance-summary-bar">
            <div
              className="attendance-summary-bar-fill is-muted"
              style={{ width: `${100 - attendanceSummary.todayRate}%` }}
            />
          </div>
          <p className="attendance-summary-meta">
            오늘 미출석 {attendanceSummary.absentCount}명
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
          {members.map((member) => {
            const isSelected = selectedMemberId === member.id;
            return (
              <div
                key={member.id}
                className={`attendance-row is-clickable${
                  isSelected ? " is-selected" : ""
                }`}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() =>
                  setSelectedMemberId((prev) =>
                    prev === member.id ? null : member.id,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedMemberId((prev) =>
                      prev === member.id ? null : member.id,
                    );
                  }
                }}
              >
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
            );
          })}
        </div>

        <div className="attendance-scroll" ref={scrollContainerRef}>
          <div className="attendance-scroll-inner">
            <div className="attendance-row attendance-header attendance-date-row attendance-week-row">
              <div className="attendance-cell attendance-week-cell is-current">
                이번주 ({thisWeekLabel})
              </div>
              <div className="attendance-cell attendance-week-cell">
                지난주 ({lastWeekLabel})
              </div>
            </div>
            <div className="attendance-row attendance-header attendance-date-row">
              {thisWeekDates.map((date, index) => {
                const dateKey = formatDateKey(date);
                const isToday = dateKey === todayKey;
                return (
                  <div
                    key={dateKey}
                    className={`attendance-cell is-current-week${
                      isToday ? " is-today" : ""
                    }`}
                    ref={index === 0 ? thisWeekStartRef : undefined}
                  >
                    <div className="attendance-date-line">
                      <span className="attendance-date">
                        {formatDateLabel(date)}
                      </span>
                      <span className="attendance-day">
                        {formatDayLabel(date)}
                      </span>
                      <span className="attendance-count">
                        {attendanceByDate.get(dateKey) ?? 0}명
                      </span>
                    </div>
                  </div>
                );
              })}
              {lastWeekDates.map((date) => {
                const dateKey = formatDateKey(date);
                const isToday = dateKey === todayKey;
                return (
                  <div
                    key={dateKey}
                    className={`attendance-cell${isToday ? " is-today" : ""}`}
                  >
                    <div className="attendance-date-line">
                      <span className="attendance-date">
                        {formatDateLabel(date)}
                      </span>
                      <span className="attendance-day">
                        {formatDayLabel(date)}
                      </span>
                      <span className="attendance-count">
                        {attendanceByDate.get(dateKey) ?? 0}명
                      </span>
                    </div>
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
              const isSelected = selectedMemberId === member.id;

              return (
                <div
                  key={member.id}
                  className={`attendance-row attendance-date-row is-clickable${
                    isSelected ? " is-selected" : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() =>
                    setSelectedMemberId((prev) =>
                      prev === member.id ? null : member.id,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedMemberId((prev) =>
                        prev === member.id ? null : member.id,
                      );
                    }
                  }}
                >
                {allDates.map((date, index) => {
                  const dateKey = formatDateKey(date);
                  const hasAttendance = attendanceDates.has(dateKey);
                  const isCurrentWeek = index < thisWeekDates.length;
                  const isToday = dateKey === todayKey;
                  return (
                    <div
                      key={dateKey}
                      className={`attendance-cell${
                        hasAttendance ? " checked" : ""
                      }${isCurrentWeek ? " is-current-week" : ""}${
                        isToday ? " is-today" : ""
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

      <div className={`panel detail-panel${selectedMember ? " is-open" : ""}`}>
        {selectedMember && (
          <>
            <div className="panel-header">
              <div>
                <h3 className="section-title">회원 상세</h3>
                <p className="section-subtitle">
                  선택한 회원의 출석 정보를 확인합니다.
                </p>
              </div>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">이름</span>
                <strong>{selectedMember.name}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">연락처</span>
                <strong>{selectedMember.phone}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">회원권</span>
                <strong>
                  {formatMembershipDuration(
                    selectedMember.membershipDuration,
                    selectedMember.membershipDurationUnit,
                    selectedMember.membershipWeeklyAttendance,
                  )}
                </strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">회원권 시작일</span>
                <strong>{formatDateValue(selectedMember.membershipAssignedAt)}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">오늘 출석</span>
                <strong>
                  {selectedMemberAttendance?.todayAttendance ? "출석" : "미출석"}
                </strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">이번주 출석 횟수</span>
                <strong>
                  {selectedMemberAttendance?.thisWeekAttendanceCount ?? 0}회
                </strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">최근 출석일</span>
                <strong>
                  {formatDateValue(selectedMemberAttendance?.latestAttendance ?? null)}
                </strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">최근 2주 출석 횟수</span>
                <strong>{selectedMember.activities.length}회</strong>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default AttendancePage;
