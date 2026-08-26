"use client";

import { useEffect, useState } from "react";

type ExpiringMember = {
  id: number;
  name: string;
  phone: string;
  birthDate: string | null;
  gender: string | null;
  parentPhone: string | null;
  memo: string | null;
  createdAt: string;
  expiresAt: string;
  reRegistrationRate?: number;
  reRegisteredCount?: number;
  expiredHistoryCount?: number;
};

type MarketingPageProps = {
  expiringMembers: ExpiringMember[];
  expiredMembers: ExpiringMember[];
  reRegistrationRate: number;
  reRegisteredCount: number;
  expiredHistoryCount: number;
  currentlyExpiredCount: number;
  todayNewMembers: number;
};

type SelectedMarketingMember = ExpiringMember & {
  listType: "expiring" | "expired";
};

const EXPIRED_MEMBERS_PAGE_SIZE = 10;
const EXPIRING_MEMBERS_PAGE_SIZE = 15;

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

const getRemainingDays = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (diffDays === 0) {
    return "당일";
  }

  return `${diffDays}일 전`;
};

const MarketingPage = ({
  expiringMembers,
  expiredMembers,
  reRegistrationRate,
  reRegisteredCount,
  expiredHistoryCount,
  currentlyExpiredCount,
  todayNewMembers,
}: MarketingPageProps) => {
  const [expiredPage, setExpiredPage] = useState(1);
  const [expiringPage, setExpiringPage] = useState(1);
  const [selectedMember, setSelectedMember] =
    useState<SelectedMarketingMember | null>(null);
  const expiredTotalPages = Math.max(
    1,
    Math.ceil(expiredMembers.length / EXPIRED_MEMBERS_PAGE_SIZE),
  );
  const expiringTotalPages = Math.max(
    1,
    Math.ceil(expiringMembers.length / EXPIRING_MEMBERS_PAGE_SIZE),
  );
  const pagedExpiredMembers = expiredMembers.slice(
    (expiredPage - 1) * EXPIRED_MEMBERS_PAGE_SIZE,
    expiredPage * EXPIRED_MEMBERS_PAGE_SIZE,
  );
  const pagedExpiringMembers = expiringMembers.slice(
    (expiringPage - 1) * EXPIRING_MEMBERS_PAGE_SIZE,
    expiringPage * EXPIRING_MEMBERS_PAGE_SIZE,
  );

  useEffect(() => {
    setExpiredPage((current) => Math.min(current, expiredTotalPages));
  }, [expiredTotalPages]);
  useEffect(() => {
    setExpiringPage((current) => Math.min(current, expiringTotalPages));
  }, [expiringTotalPages]);

  useEffect(() => {
    if (!selectedMember) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedMember(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMember]);

  return (
    <section className="marketing">
      <header className="marketing-header">
        <div>
          <h2>마케팅</h2>
          <p className="marketing-subtitle">
            만료 7일 전부터 당일까지의 회원을 한 번에 확인할 수 있습니다.
          </p>
        </div>
      </header>
      <section className="panel marketing-panel">
        <div className="panel-header">
          <h3>만료 7일 이내 회원</h3>
          <div className="pagination">
            <span className="count">{expiringMembers.length}명</span>
            <button
              className="button-ghost"
              type="button"
              onClick={() => setExpiringPage((page) => Math.max(1, page - 1))}
              disabled={expiringPage === 1}
            >
              이전
            </button>
            <span className="pagination-status">
              {expiringPage} / {expiringTotalPages}
            </span>
            <button
              className="button-ghost"
              type="button"
              onClick={() =>
                setExpiringPage((page) => Math.min(expiringTotalPages, page + 1))
              }
              disabled={expiringPage === expiringTotalPages}
            >
              다음
            </button>
          </div>
        </div>
        {expiringMembers.length ? (
          <div className="table-wrap">
            <table className="member-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>연락처</th>
                  <th className="number">만료일</th>
                  <th className="number">남은 기간</th>
                </tr>
              </thead>
              <tbody>
                {pagedExpiringMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="row"
                    onClick={() =>
                      setSelectedMember({ ...member, listType: "expiring" })
                    }
                  >
                    <td>{member.name}</td>
                    <td>{member.phone}</td>
                    <td className="number">{formatDate(member.expiresAt)}</td>
                    <td className="number">{getRemainingDays(member.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">해당 없음</p>
        )}
      </section>
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
                    onClick={() =>
                      setSelectedMember({ ...member, listType: "expired" })
                    }
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
      {selectedMember ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="modal attendance-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketing-member-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <div>
                <h3 id="marketing-member-detail-title" className="section-title">
                  회원 정보
                </h3>
                <p className="section-subtitle">
                  {selectedMember.listType === "expiring"
                    ? "만료 예정 회원 정보입니다."
                    : "만료 후 미재등록 회원 정보입니다."}
                </p>
              </div>
              <button
                className="button-ghost"
                type="button"
                onClick={() => setSelectedMember(null)}
              >
                닫기
              </button>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">회원번호</span>
                <strong>{selectedMember.id}</strong>
              </div>
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
                <strong>
                  {selectedMember.birthDate
                    ? formatDate(selectedMember.birthDate)
                    : "-"}
                </strong>
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
                <strong>{formatDate(selectedMember.createdAt)}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">만료일</span>
                <strong>{formatDate(selectedMember.expiresAt)}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">
                  {selectedMember.listType === "expiring" ? "남은 기간" : "경과"}
                </span>
                <strong>
                  {selectedMember.listType === "expiring"
                    ? getRemainingDays(selectedMember.expiresAt)
                    : getElapsedDays(selectedMember.expiresAt)}
                </strong>
              </div>
              {selectedMember.listType === "expired" ? (
                <div className="detail-item">
                  <span className="detail-label">재등록률</span>
                  <strong>
                    {selectedMember.reRegistrationRate ?? 0}% (
                    {selectedMember.reRegisteredCount ?? 0}/
                    {selectedMember.expiredHistoryCount ?? 0})
                  </strong>
                </div>
              ) : null}
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

export default MarketingPage;
