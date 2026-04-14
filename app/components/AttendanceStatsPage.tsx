"use client";

import { useEffect, useMemo, useState } from "react";

type AttendanceActivity = {
  createdAt: string;
};

type AttendanceMember = {
  id: number;
  name: string;
  birthDate: string | null;
  phone: string;
  gender: string | null;
  parentPhone: string | null;
  memo: string | null;
  status: string;
  membershipId: number | null;
  membershipDuration: number | null;
  membershipDurationUnit: "MONTH" | "DAY" | null;
  membershipWeeklyAttendance: number | null;
  membershipPrice: number | null;
  membershipAssignedAt: string | null;
  membershipExpiresAt: string | null;
  membershipPausedAt: string | null;
  membershipTotalPausedMs: number;
  activities: AttendanceActivity[];
  createdAt: string;
};

type AttendanceStatsPageProps = {
  members: AttendanceMember[];
};

type MemberAttendanceStat = {
  id: number;
  name: string;
  birthDate: string | null;
  phone: string;
  membership: string;
  count: number;
  latestAttendanceAt: string | null;
};

const formatNumber = (value: number) =>
  Intl.NumberFormat("ko-KR").format(value);

const formatBirthDate = (birthDate: string | null) => {
  if (!birthDate) return "";

  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("ko-KR").replace(/\.\s/g, ".").replace(/\.$/, "");
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getAge = (birthDate: string | null) => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
};

const getStatusLabel = (
  status: string,
  isPaused: boolean,
  hasMembership: boolean,
) => {
  if (status === "DELETE") {
    return {
      label: "중지",
      isDeleted: true,
      isPaused: false,
      isMembershipActive: false,
      icon: "⛔",
    };
  }
  if (isPaused) {
    return {
      label: "일시정지",
      isDeleted: false,
      isPaused: true,
      isMembershipActive: false,
      icon: "⏸️",
    };
  }
  if (hasMembership) {
    return {
      label: "회원권 보유",
      isDeleted: false,
      isPaused: false,
      isMembershipActive: true,
      icon: "✅",
    };
  }
  return {
    label: "정상",
    isDeleted: false,
    isPaused: false,
    isMembershipActive: false,
    icon: null,
  };
};

const resolveExpiryDate = (
  expiresAt: string | null,
  assignedAt: string | null,
  duration: number | null,
  durationUnit: "MONTH" | "DAY" | null,
  totalPausedMs: number,
) => {
  if (expiresAt) {
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    const adjusted = new Date(parsed);
    adjusted.setTime(parsed.getTime() + totalPausedMs);
    return adjusted;
  }
  if (!assignedAt || !duration) {
    return null;
  }
  const startDate = new Date(assignedAt);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }
  const derivedExpiry = new Date(startDate);
  if (durationUnit === "DAY") {
    derivedExpiry.setDate(derivedExpiry.getDate() + Math.max(duration - 1, 0));
    derivedExpiry.setHours(23, 59, 59, 999);
  } else {
    derivedExpiry.setMonth(derivedExpiry.getMonth() + duration);
  }
  derivedExpiry.setTime(derivedExpiry.getTime() + totalPausedMs);
  return derivedExpiry;
};

const formatMembershipLabel = (
  duration: number | null,
  unit: "MONTH" | "DAY" | null,
  weeklyAttendance: number | null,
  price: number | null,
) => {
  if (!duration || !unit || weeklyAttendance === null || price === null) {
    return "-";
  }

  return `${duration}${unit === "DAY" ? "일" : "개월"} · 주 ${weeklyAttendance}회 · ${price.toLocaleString(
    "ko-KR",
  )}원`;
};

const formatMembership = (
  duration: number | null,
  unit: "MONTH" | "DAY" | null,
  weeklyAttendance: number | null,
) => {
  if (!duration || !unit) return "-";
  const base = `${duration}${unit === "DAY" ? "일" : "개월"}`;
  if (weeklyAttendance === null) {
    return base;
  }
  return `${base} (주 ${weeklyAttendance}회)`;
};

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
};

const hasMembershipStarted = (assignedAt: string | null) => {
  if (!assignedAt) return false;
  const parsed = new Date(assignedAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed <= new Date();
};

const AttendanceStatsPage = ({ members }: AttendanceStatsPageProps) => {
  const activeMembers = useMemo(
    () => members.filter((member) => hasMembershipStarted(member.membershipAssignedAt)),
    [members],
  );
  const [startDate, setStartDate] = useState(() => getCurrentMonthRange().start);
  const [endDate, setEndDate] = useState(() => getCurrentMonthRange().end);
  const [showOnlyNoAttendance, setShowOnlyNoAttendance] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  const periodLabel = `${startDate} ~ ${endDate}`;

  const { totalAttendanceCount, activeMembersCount, memberStats } = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return {
        totalAttendanceCount: 0,
        activeMembersCount: 0,
        memberStats: [],
      };
    }

    if (start > end) {
      return {
        totalAttendanceCount: 0,
        activeMembersCount: 0,
        memberStats: [],
      };
    }

    const stats: MemberAttendanceStat[] = activeMembers.map((member) => {
      const attendanceDates = member.activities
        .map((activity) => activity.createdAt)
        .filter((createdAt) => {
          const parsed = new Date(createdAt);
          return parsed >= start && parsed <= end;
        })
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const count = attendanceDates.length;

      return {
        id: member.id,
        name: member.name,
        birthDate: member.birthDate,
        phone: member.phone,
        membership: formatMembership(
          member.membershipDuration,
          member.membershipDurationUnit,
          member.membershipWeeklyAttendance,
        ),
        count,
        latestAttendanceAt: attendanceDates[0] ?? null,
      };
    });

    const sortedStats = [...stats].sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.name.localeCompare(b.name);
    });

    const totalAttendanceCount = stats.reduce((sum, item) => sum + item.count, 0);
    const activeMembersCount = stats.filter((item) => item.count > 0).length;

    return {
      totalAttendanceCount,
      activeMembersCount,
      memberStats: sortedStats,
    };
  }, [activeMembers, startDate, endDate]);

  const absentMembersCount = activeMembers.length - activeMembersCount;
  const visibleMemberStats = showOnlyNoAttendance
    ? memberStats.filter((item) => item.count === 0)
    : memberStats;
  const selectedMemberStat =
    visibleMemberStats.find((member) => member.id === selectedMemberId) ?? null;
  const selectedMember =
    activeMembers.find((member) => member.id === selectedMemberId) ?? null;
  const selectedMemberAttendanceDates = useMemo(() => {
    if (!selectedMember) {
      return [];
    }

    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return [];
    }

    return selectedMember.activities
      .map((activity) => activity.createdAt)
      .filter((createdAt) => {
        const parsed = new Date(createdAt);
        return parsed >= start && parsed <= end;
      })
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [selectedMember, startDate, endDate]);
  const selectedMemberStatus = selectedMember
    ? getStatusLabel(
        selectedMember.status,
        Boolean(selectedMember.membershipPausedAt),
        Boolean(selectedMember.membershipId) &&
          hasMembershipStarted(selectedMember.membershipAssignedAt),
      )
    : null;
  const selectedMembershipLabel = selectedMember
    ? formatMembershipLabel(
        selectedMember.membershipDuration,
        selectedMember.membershipDurationUnit,
        selectedMember.membershipWeeklyAttendance,
        selectedMember.membershipPrice,
      )
    : "-";
  const selectedMembershipExpiryDate = selectedMember
    ? resolveExpiryDate(
        selectedMember.membershipExpiresAt,
        selectedMember.membershipAssignedAt,
        selectedMember.membershipDuration,
        selectedMember.membershipDurationUnit,
        selectedMember.membershipTotalPausedMs,
      )
    : null;

  useEffect(() => {
    if (selectedMemberId === null) {
      return;
    }

    if (!visibleMemberStats.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(null);
    }
  }, [selectedMemberId, visibleMemberStats]);

  return (
    <section className="panel list-panel">
      <div className="list-panel-actions">
        <div>
          <h2 className="section-title">출석통계</h2>
        </div>
      </div>

      <div className="attendance-stats-filters">
        <label className="attendance-stat-filter-item">
          <span>시작일</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label className="attendance-stat-filter-item">
          <span>종료일</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
        <label className="attendance-stat-filter-item attendance-stat-filter-item-inline">
          <span>미출석 회원만 보기</span>
          <input
            type="checkbox"
            checked={showOnlyNoAttendance}
            onChange={(event) => setShowOnlyNoAttendance(event.target.checked)}
          />
        </label>
      </div>

      <div className="attendance-summary">
        <div className="attendance-summary-card">
          <div className="attendance-summary-header">
            <span className="attendance-summary-title">조회 기간</span>
            <span className="attendance-summary-value">{periodLabel}</span>
          </div>
        </div>

        <div className="attendance-summary-card">
          <div className="attendance-summary-header">
            <span className="attendance-summary-title">총 출석 횟수</span>
            <span className="attendance-summary-value">
              {formatNumber(totalAttendanceCount)}회
            </span>
          </div>
          <div className="attendance-summary-bar">
            <div className="attendance-summary-bar-fill is-accent" style={{ width: "100%" }} />
          </div>
        </div>

        <div className="attendance-summary-card">
          <div className="attendance-summary-header">
            <span className="attendance-summary-title">출석한 회원</span>
            <span className="attendance-summary-value">{formatNumber(activeMembersCount)}명</span>
          </div>
          <div className="attendance-summary-bar">
            <div
              className="attendance-summary-bar-fill is-weekly"
              style={{
                width: `${
                  activeMembers.length > 0
                    ? Math.round((activeMembersCount / activeMembers.length) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        <div className="attendance-summary-card">
          <div className="attendance-summary-header">
            <span className="attendance-summary-title">미출석 회원</span>
            <span className="attendance-summary-value">{formatNumber(absentMembersCount)}명</span>
          </div>
          <div className="attendance-summary-bar">
            <div
              className="attendance-summary-bar-fill is-muted"
              style={{
                width: `${
                  activeMembers.length > 0
                    ? Math.round((absentMembersCount / activeMembers.length) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="panel detail-panel is-open">
        <div className="panel-header">
          <div>
            <h3 className="section-title">회원별 출석 횟수</h3>
          </div>
        </div>
        <div className="attendance-stats-table">
          <div className="attendance-stats-head">
            <span>회원명</span>
            <span>연락처</span>
            <span>회원권</span>
            <span>출석 횟수</span>
          </div>
          {visibleMemberStats.length > 0 ? (
            visibleMemberStats.map((member) => (
              <button
                key={member.id}
                type="button"
                className={`attendance-stats-row${
                  selectedMemberId === member.id ? " is-selected" : ""
                }`}
                onClick={() => setSelectedMemberId(member.id)}
              >
                <span>
                  {member.name}
                  {member.birthDate ? ` (${formatBirthDate(member.birthDate)})` : ""}
                </span>
                <span>{member.phone || "-"}</span>
                <span>{member.membership}</span>
                <span>{member.count}회</span>
              </button>
            ))
          ) : (
            <p className="attendance-summary-meta">기간 또는 회원 데이터가 없습니다.</p>
          )
          }
        </div>
      </div>

      <div className={`panel detail-panel${selectedMemberStat ? " is-open" : ""}`}>
        {selectedMemberStat && selectedMember ? (
          <>
            <div className="panel-header">
              <div>
                <h3 className="section-title">회원 상세</h3>
                <p className="section-subtitle">
                  선택한 회원의 출석 정보와 기간 내 방문 내역입니다.
                </p>
              </div>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">회원 번호</span>
                <strong>{selectedMember.id}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">이름</span>
                <strong>
                  {selectedMemberStat.name}
                  {selectedMemberStat.birthDate
                    ? ` (${formatBirthDate(selectedMemberStat.birthDate)})`
                    : ""}
                </strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">연락처</span>
                <strong>{selectedMemberStat.phone || "-"}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">생년월일</span>
                <strong>
                  {selectedMember.birthDate
                    ? new Date(selectedMember.birthDate).toLocaleDateString("ko-KR")
                    : "-"}
                </strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">나이</span>
                <strong>{getAge(selectedMember.birthDate) ?? "-"}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">성별</span>
                <strong>{selectedMember.gender || "-"}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">부모님 연락처</span>
                <strong>{selectedMember.parentPhone || "-"}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">등록일</span>
                <strong>{new Date(selectedMember.createdAt).toLocaleDateString("ko-KR")}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">상태</span>
                <strong>
                  {selectedMemberStatus && (
                    <span
                      className={`status-label${
                        selectedMemberStatus.isDeleted
                          ? " is-deleted"
                          : selectedMemberStatus.isPaused
                            ? " is-paused"
                            : selectedMemberStatus.isMembershipActive
                              ? " is-membership"
                              : ""
                      }`}
                    >
                      {selectedMemberStatus.icon && (
                        <span aria-hidden="true">{selectedMemberStatus.icon}</span>
                      )}
                      {selectedMemberStatus.label}
                    </span>
                  )}
                </strong>
              </div>
              <div className="detail-item detail-item--wide">
                <span className="detail-label">회원권</span>
                <strong>{selectedMembershipLabel}</strong>
              </div>
              <div className="detail-item detail-item--wide">
                <span className="detail-label">시작일</span>
                <strong>
                  {selectedMember.membershipAssignedAt
                    ? new Date(selectedMember.membershipAssignedAt).toLocaleDateString("ko-KR")
                    : "-"}
                </strong>
              </div>
              <div className="detail-item detail-item--wide">
                <span className="detail-label">만료일</span>
                <strong>
                  {selectedMember.membershipPausedAt
                    ? "-"
                    : selectedMembershipExpiryDate?.toLocaleDateString("ko-KR") ?? "-"}
                </strong>
              </div>
            </div>

            <div className="detail-memo attendance-stats-history">
              <div className="detail-memo-content">
                <div>
                  <span className="detail-label">{periodLabel} 출석 횟수</span>
                  <p>{selectedMemberStat.count}회</p>
                </div>
                <div>
                  <span className="detail-label">최근 출석</span>
                  <p>{formatDateTime(selectedMemberStat.latestAttendanceAt)}</p>
                </div>
              </div>
            </div>

            <div className="detail-memo">
              <div className="detail-memo-content">
                <div>
                  <span className="detail-label">메모</span>
                  <p>{selectedMember.memo?.trim() ? selectedMember.memo : "메모가 없습니다."}</p>
                </div>
              </div>
            </div>

            <div className="detail-memo attendance-stats-history">
              <div className="detail-memo-content">
                <div>
                  <span className="detail-label">기간 내 출석 내역</span>
                  {selectedMemberAttendanceDates.length > 0 ? (
                    <div className="attendance-stats-history-list">
                      {selectedMemberAttendanceDates.map((createdAt) => (
                        <div key={createdAt} className="attendance-stats-history-item">
                          {formatDateTime(createdAt)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="detail-empty">선택한 기간에 출석 기록이 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
};

export default AttendanceStatsPage;
