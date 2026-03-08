"use client";

import { useMemo, useState } from "react";

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

type AttendanceStatsPageProps = {
  members: AttendanceMember[];
};

type MemberAttendanceStat = {
  id: number;
  name: string;
  phone: string;
  membership: string;
  count: number;
};

const formatNumber = (value: number) =>
  Intl.NumberFormat("ko-KR").format(value);

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

const AttendanceStatsPage = ({ members }: AttendanceStatsPageProps) => {
  const [startDate, setStartDate] = useState(() => getCurrentMonthRange().start);
  const [endDate, setEndDate] = useState(() => getCurrentMonthRange().end);
  const [showOnlyNoAttendance, setShowOnlyNoAttendance] = useState(false);

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

    const stats: MemberAttendanceStat[] = members.map((member) => {
      const count = member.activities.reduce((acc, activity) => {
        const createdAt = new Date(activity.createdAt);
        return createdAt >= start && createdAt <= end ? acc + 1 : acc;
      }, 0);

      return {
        id: member.id,
        name: member.name,
        phone: member.phone,
        membership: formatMembership(
          member.membershipDuration,
          member.membershipDurationUnit,
          member.membershipWeeklyAttendance,
        ),
        count,
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
  }, [members, startDate, endDate]);

  const absentMembersCount = members.length - activeMembersCount;
  const visibleMemberStats = showOnlyNoAttendance
    ? memberStats.filter((item) => item.count === 0)
    : memberStats;

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
                  members.length > 0
                    ? Math.round((activeMembersCount / members.length) * 100)
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
                  members.length > 0
                    ? Math.round((absentMembersCount / members.length) * 100)
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
              <div key={member.id} className="attendance-stats-row">
                <span>{member.name}</span>
                <span>{member.phone || "-"}</span>
                <span>{member.membership}</span>
                <span>{member.count}회</span>
              </div>
            ))
          ) : (
            <p className="attendance-summary-meta">기간 또는 회원 데이터가 없습니다.</p>
          )
          }
        </div>
      </div>
    </section>
  );
};

export default AttendanceStatsPage;
