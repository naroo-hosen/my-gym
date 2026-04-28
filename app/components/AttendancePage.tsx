"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AttendanceActivity = {
  createdAt: string;
};

type AttendanceMember = {
  id: number;
  name: string;
  birthDate: string | null;
  phone: string;
  memo: string | null;
  membershipDuration: number | null;
  membershipDurationUnit: "MONTH" | "DAY" | null;
  membershipWeeklyAttendance: number | null;
  membershipAssignedAt: string | null;
  activities: AttendanceActivity[];
};

type AttendancePageProps = {
  members: AttendanceMember[];
};

type AttendanceSort = {
  dateKey: string;
  direction: "desc" | "asc";
} | null;

const buildWeekDates = (baseDate = new Date(), weekOffset = 0) => {
  const today = new Date(baseDate);
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  const diffToMonday = (day + 6) % 7;
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - diffToMonday + weekOffset * 7);
  const weekDates: Date[] = [];

  for (let i = 0; i < 7; i += 1) {
    const current = new Date(currentWeekStart);
    current.setDate(currentWeekStart.getDate() + i);
    weekDates.push(current);
  }

  return weekDates;
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

const formatAttendanceTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
};

const getAttendanceTimeValueForDate = (
  activities: AttendanceActivity[],
  dateKey: string,
) =>
  activities.reduce<number | null>((latest, activity) => {
    const activityDate = new Date(activity.createdAt);
    if (Number.isNaN(activityDate.getTime())) {
      return latest;
    }
    activityDate.setHours(0, 0, 0, 0);
    if (formatDateKey(activityDate) !== dateKey) {
      return latest;
    }
    const timeValue = new Date(activity.createdAt).getTime();
    if (Number.isNaN(timeValue)) {
      return latest;
    }
    return latest === null || timeValue > latest ? timeValue : latest;
  }, null);

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

const hasMembershipStarted = (assignedAt: string | null) => {
  if (!assignedAt) return false;
  const parsed = new Date(assignedAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed <= new Date();
};

const AttendancePage = ({ members }: AttendancePageProps) => {
  const router = useRouter();
  const activeMembers = useMemo(
    () => members.filter((member) => hasMembershipStarted(member.membershipAssignedAt)),
    [members],
  );
  const [weekOffset, setWeekOffset] = useState(0);
  const visibleDates = useMemo(
    () => buildWeekDates(new Date(), weekOffset),
    [weekOffset],
  );
  const todayKey = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return formatDateKey(today);
  }, []);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const thisWeekStartRef = useRef<HTMLDivElement | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [attendanceSort, setAttendanceSort] = useState<AttendanceSort>(null);
  const visibleLabel =
    visibleDates.length > 0
      ? `${formatDateLabel(visibleDates[0])} ~ ${formatDateLabel(
          visibleDates[visibleDates.length - 1],
        )}`
      : "";
  const periodLabel =
    weekOffset === 0 ? "이번주" : `${Math.abs(weekOffset)}주 전`;
  const allDates = visibleDates;
  const attendanceByDate = useMemo(() => {
    const map = new Map<string, number>();
    allDates.forEach((date) => {
      map.set(formatDateKey(date), 0);
    });

    activeMembers.forEach((member) => {
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
  }, [activeMembers, allDates]);
  const attendanceSummary = useMemo(() => {
    const totalMembers = activeMembers.length;
    const selectedWeekKeys = new Set(
      visibleDates.map((date) => formatDateKey(date)),
    );
    let todayCount = 0;
    let selectedWeekCount = 0;

    activeMembers.forEach((member) => {
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

      const hasSelectedWeekAttendance = Array.from(selectedWeekKeys).some((key) =>
        attendanceDates.has(key),
      );
      if (hasSelectedWeekAttendance) {
        selectedWeekCount += 1;
      }
    });

    const todayRate = totalMembers
      ? Math.round((todayCount / totalMembers) * 100)
      : 0;
    const selectedWeekRate = totalMembers
      ? Math.round((selectedWeekCount / totalMembers) * 100)
      : 0;
    const absentCount = totalMembers - todayCount;

    return {
      totalMembers,
      todayCount,
      todayRate,
      selectedWeekCount,
      selectedWeekRate,
      absentCount,
    };
  }, [activeMembers, visibleDates, todayKey]);
  const selectedMember = useMemo(
    () => activeMembers.find((member) => member.id === selectedMemberId) ?? null,
    [activeMembers, selectedMemberId],
  );
  const selectedMemberAttendance = useMemo(() => {
    if (!selectedMember) return null;
    const attendanceDates = selectedMember.activities.map((activity) => {
      const activityDate = new Date(activity.createdAt);
      activityDate.setHours(0, 0, 0, 0);
      return formatDateKey(activityDate);
    });
    const attendanceSet = new Set(attendanceDates);
    const selectedWeekAttendanceCount = visibleDates.reduce((count, date) => {
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
      selectedWeekAttendanceCount,
      latestAttendance,
    };
  }, [selectedMember, visibleDates, todayKey]);
  const sortedMembers = useMemo(() => {
    if (!attendanceSort) {
      return activeMembers;
    }

    return [...activeMembers].sort((firstMember, secondMember) => {
      const firstTime = getAttendanceTimeValueForDate(
        firstMember.activities,
        attendanceSort.dateKey,
      );
      const secondTime = getAttendanceTimeValueForDate(
        secondMember.activities,
        attendanceSort.dateKey,
      );

      if (firstTime === null && secondTime === null) {
        return firstMember.name.localeCompare(secondMember.name, "ko-KR");
      }
      if (firstTime === null) {
        return 1;
      }
      if (secondTime === null) {
        return -1;
      }

      return attendanceSort.direction === "desc"
        ? secondTime - firstTime
        : firstTime - secondTime;
    });
  }, [activeMembers, attendanceSort]);

  const handleAttendanceSortClick = (dateKey: string) => {
    setAttendanceSort((prev) => {
      if (prev?.dateKey !== dateKey) {
        return { dateKey, direction: "desc" };
      }

      return {
        dateKey,
        direction: prev.direction === "desc" ? "asc" : "desc",
      };
    });
  };

  const handleAttendanceCellClick = async (
    member: AttendanceMember,
    dateKey: string,
    hasAttendance: boolean,
  ) => {
    const confirmMessage = hasAttendance
      ? "출석체크 취소 처리 하시겠습니까?"
      : "출석체크 처리 하시겠습니까?";
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: member.phone,
          date: dateKey,
          action: hasAttendance ? "uncheck" : "check",
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        alert(
          payload?.message ?? "요청 처리 중 오류가 발생했습니다.",
        );
        return;
      }

      const isSuccess =
        (!hasAttendance && payload?.status === "ok") ||
        (hasAttendance && payload?.status === "canceled");
      if (!isSuccess) {
        alert(payload?.message ?? "요청을 처리할 수 없습니다.");
        return;
      }

      router.refresh();
    } catch {
      alert("서버와 통신 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    if (!scrollContainerRef.current) {
      return;
    }
    const container = scrollContainerRef.current;
    container.scrollTo({ left: 0, behavior: "auto" });
  }, [weekOffset]);

  return (
    <section className="panel list-panel">
      <div className="list-panel-actions">
        <div>
          <h2 className="section-title">출석 현황</h2>
          <p className="section-subtitle">
            시작일이 지난 회원권 보유 회원의 최근 1주일 출석 기록을
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
              {attendanceSummary.selectedWeekRate}%
            </span>
          </div>
          <div className="attendance-summary-bar">
            <div
              className="attendance-summary-bar-fill is-weekly"
              style={{ width: `${attendanceSummary.selectedWeekRate}%` }}
            />
          </div>
          <p className="attendance-summary-meta">
            {periodLabel} 출석자{" "}
            {attendanceSummary.selectedWeekCount} /{" "}
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

      <div className="attendance-week-controls">
        <div className="actions">
          <button
            type="button"
            className="button-secondary"
            onClick={() => setWeekOffset((prev) => prev - 1)}
          >
            지난주 보기
          </button>
          {weekOffset !== 0 ? (
            <button
              type="button"
              className="button-secondary"
              onClick={() =>
                setWeekOffset((prev) => (prev + 1 > 0 ? 0 : prev + 1))
              }
            >
              다음주 보기
            </button>
          ) : null}
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
          {sortedMembers.map((member) => {
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
                {periodLabel} ({visibleLabel})
              </div>
            </div>
            <div className="attendance-row attendance-header attendance-date-row">
              {allDates.map((date, index) => {
                const dateKey = formatDateKey(date);
                const isToday = dateKey === todayKey;
                const isSorted = attendanceSort?.dateKey === dateKey;
                return (
                  <div
                    key={dateKey}
                    className={`attendance-cell is-current-week${
                      isToday ? " is-today" : ""
                    }`}
                    ref={index === 0 ? thisWeekStartRef : undefined}
                  >
                    <button
                      type="button"
                      className={`attendance-date-sort${
                        isSorted ? " is-active" : ""
                      }`}
                      onClick={() => handleAttendanceSortClick(dateKey)}
                      aria-pressed={isSorted}
                      aria-label={`${formatDateLabel(date)} 출석 시각 ${
                        isSorted && attendanceSort.direction === "asc"
                          ? "빠른 순"
                          : "늦은 순"
                      } 정렬`}
                    >
                      <span className="attendance-date">
                        {formatDateLabel(date)}
                      </span>
                      <span className="attendance-day">
                        {formatDayLabel(date)}
                      </span>
                      <span className="attendance-count">
                        {attendanceByDate.get(dateKey) ?? 0}명
                      </span>
                      <span className="attendance-sort-arrow" aria-hidden="true">
                        {isSorted
                          ? attendanceSort.direction === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            {sortedMembers.map((member) => {
              const attendanceTimes = new Map(
                member.activities.map((activity) => {
                  const activityDate = new Date(activity.createdAt);
                  activityDate.setHours(0, 0, 0, 0);
                  return [
                    formatDateKey(activityDate),
                    formatAttendanceTime(activity.createdAt),
                  ];
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
                  const attendanceTime = attendanceTimes.get(dateKey) ?? "";
                  const hasAttendance = attendanceTime.length > 0;
                  const isToday = dateKey === todayKey;
                  return (
                    <div
                      key={dateKey}
                      className={`attendance-cell${
                        hasAttendance ? " checked" : ""
                      } is-current-week${isToday ? " is-today" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleAttendanceCellClick(
                          member,
                          dateKey,
                          hasAttendance,
                        );
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleAttendanceCellClick(
                            member,
                            dateKey,
                            hasAttendance,
                          );
                        }
                      }}
                    >
                      {hasAttendance ? `✔︎ ${attendanceTime}` : "-"}
                    </div>
                  );
                })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedMember ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setSelectedMemberId(null)}
        >
          <div
            className="modal attendance-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <div>
                <h3 id="attendance-detail-title" className="section-title">
                  회원 상세
                </h3>
                <p className="section-subtitle">
                  선택한 회원의 출석 정보를 확인합니다.
                </p>
              </div>
              <button
                className="button-ghost"
                type="button"
                onClick={() => setSelectedMemberId(null)}
              >
                닫기
              </button>
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
                <span className="detail-label">생년월일</span>
                <strong>{formatDateValue(selectedMember.birthDate)}</strong>
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
                <span className="detail-label">
                  {periodLabel} 출석 횟수
                </span>
                <strong>
                  {selectedMemberAttendance?.selectedWeekAttendanceCount ?? 0}회
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
              <div className="detail-item detail-item--wide">
                <span className="detail-label">메모</span>
                <strong>{selectedMember.memo || "-"}</strong>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default AttendancePage;
