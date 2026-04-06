"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

type ExpiringMember = {
  id: number;
  name: string;
  phone: string;
  expiresAt: string;
  reRegistrationRate?: number;
  reRegisteredCount?: number;
  expiredHistoryCount?: number;
};

type ExpiringBucket = {
  label: string;
  days: number;
  members: ExpiringMember[];
};

type MarketingPageProps = {
  buckets: ExpiringBucket[];
  expiredMembers: ExpiringMember[];
  reRegistrationRate: number;
  reRegisteredCount: number;
  expiredHistoryCount: number;
  currentlyExpiredCount: number;
  todayNewMembers: number;
  totalMembersWithMembership: number;
};

const EXPIRED_MEMBERS_PAGE_SIZE = 10;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
};

const getElapsedDays = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000),
  );

  return diffDays > 0 ? `${diffDays}일` : "당일";
};

const MarketingPage = ({
  buckets,
  expiredMembers,
  reRegistrationRate,
  reRegisteredCount,
  expiredHistoryCount,
  currentlyExpiredCount,
  todayNewMembers,
  totalMembersWithMembership,
}: MarketingPageProps) => {
  const router = useRouter();
  const baseCount = Math.max(1, totalMembersWithMembership);
  const [expiredPage, setExpiredPage] = useState(1);
  const expiredTotalPages = Math.max(
    1,
    Math.ceil(expiredMembers.length / EXPIRED_MEMBERS_PAGE_SIZE),
  );
  const pagedExpiredMembers = expiredMembers.slice(
    (expiredPage - 1) * EXPIRED_MEMBERS_PAGE_SIZE,
    expiredPage * EXPIRED_MEMBERS_PAGE_SIZE,
  );

  useEffect(() => {
    setExpiredPage((current) => Math.min(current, expiredTotalPages));
  }, [expiredTotalPages]);

  return (
    <section className="marketing">
      <header className="marketing-header">
        <div>
          <h2>마케팅</h2>
          <p className="marketing-subtitle">
            만료 예정 회원에게 안내 메시지를 보낼 수 있도록 기간별로 정리했습니다.
          </p>
        </div>
      </header>
      <div className="marketing-grid">
        {buckets.map((bucket) => (
          <section className="panel marketing-panel" key={bucket.days}>
            <div className="panel-header">
              <h3>{bucket.label}</h3>
              <span className="count">{bucket.members.length}명</span>
            </div>
            {bucket.members.length ? (
              <div className="table-wrap">
                <table className="member-table">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>연락처</th>
                      <th className="number">만료일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bucket.members.map((member) => (
                      <tr
                        key={member.id}
                        className="row"
                        onClick={() => router.push(`/?memberId=${member.id}`)}
                      >
                        <td>{member.name}</td>
                        <td>{member.phone}</td>
                        <td className="number">{formatDate(member.expiresAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">해당 없음</p>
            )}
          </section>
        ))}
      </div>
      <section className="panel marketing-retention">
        <div className="panel-header">
          <h3>재등록률</h3>
          <span className="count">{reRegistrationRate}%</span>
        </div>
        <div className="marketing-summary">
          <div className="marketing-summary-card">
            <span className="marketing-summary-label">재등록률</span>
            <strong className="marketing-summary-value">
              {reRegistrationRate}%
            </strong>
            <span className="marketing-summary-meta">
              누적 만료 {expiredHistoryCount}건 중 재등록 {reRegisteredCount}건
            </span>
          </div>
          <div className="marketing-summary-card">
            <span className="marketing-summary-label">현재 미재등록 회원</span>
            <strong className="marketing-summary-value">
              {currentlyExpiredCount}명
            </strong>
            <span className="marketing-summary-meta">
              지금 바로 재등록 캠페인 대상으로 볼 수 있는 회원 수
            </span>
          </div>
          <div className="marketing-summary-card">
            <span className="marketing-summary-label">오늘 신규 등록</span>
            <strong className="marketing-summary-value">
              {todayNewMembers}명
            </strong>
            <span className="marketing-summary-meta">
              오늘 새로 등록된 회원 수
            </span>
          </div>
        </div>
      </section>
      <section className="panel marketing-insights">
        <div className="panel-header">
          <h3>만료 예정 분포</h3>
          <span className="count">{totalMembersWithMembership}명 기준</span>
        </div>
        <div
          className="marketing-chart"
          style={{ "--max": baseCount } as CSSProperties}
        >
          {buckets.map((bucket) => {
            const percentage = Math.round(
              (bucket.members.length / baseCount) * 100,
            );
            return (
              <div className="marketing-chart-item" key={bucket.days}>
                <div className="marketing-chart-label">{bucket.label}</div>
                <div className="marketing-chart-track">
                  <div
                    className="marketing-chart-bar"
                    style={
                      {
                        "--value": bucket.members.length,
                      } as CSSProperties
                    }
                  />
                </div>
                <div className="marketing-chart-value">
                  {bucket.members.length}명 ({percentage}%)
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel marketing-expired">
        <div className="panel-header">
          <h3>만료 후 미재등록 회원</h3>
          <div className="pagination">
            <span className="count">{expiredMembers.length}명</span>
            <button
              className="button-ghost"
              type="button"
              onClick={() => setExpiredPage((page) => Math.max(1, page - 1))}
              disabled={expiredPage === 1}
            >
              이전
            </button>
            <span className="pagination-status">
              {expiredPage} / {expiredTotalPages}
            </span>
            <button
              className="button-ghost"
              type="button"
              onClick={() =>
                setExpiredPage((page) => Math.min(expiredTotalPages, page + 1))
              }
              disabled={expiredPage === expiredTotalPages}
            >
              다음
            </button>
          </div>
        </div>
        {expiredMembers.length ? (
          <div className="table-wrap">
            <table className="member-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>연락처</th>
                  <th className="number">만료일</th>
                  <th className="number">경과</th>
                  <th className="number">재등록률</th>
                </tr>
              </thead>
              <tbody>
                {pagedExpiredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="row"
                    onClick={() => router.push(`/?memberId=${member.id}`)}
                  >
                    <td>{member.name}</td>
                    <td>{member.phone}</td>
                    <td className="number">{formatDate(member.expiresAt)}</td>
                    <td className="number">{getElapsedDays(member.expiresAt)}</td>
                    <td className="number">
                      {member.reRegistrationRate ?? 0}% ({member.reRegisteredCount ?? 0}/
                      {member.expiredHistoryCount ?? 0})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">해당 없음</p>
        )}
      </section>
    </section>
  );
};

export default MarketingPage;
