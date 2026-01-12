"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createMembership,
  deleteMembership,
  restoreMembership,
} from "@/app/actions";

type Membership = {
  id: number;
  duration: number;
  weeklyAttendance: number;
  price: number;
  status: string;
  createdAt: string;
};

type MembershipPageProps = {
  memberships: Membership[];
};

const PAGE_SIZE = 8;

const getStatusLabel = (status: string) => {
  if (status === "DELETE") {
    return { label: "중지", isDeleted: true };
  }
  return { label: "정상", isDeleted: false };
};

const formatPrice = (price: number) => `${price.toLocaleString("ko-KR")}원`;

const MembershipPage = ({ memberships }: MembershipPageProps) => {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMembershipId, setSelectedMembershipId] = useState<number | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingRestoreId, setPendingRestoreId] = useState<number | null>(null);

  const countLabel = useMemo(
    () => `총 ${memberships.length}개`,
    [memberships.length],
  );
  const selectedMembership = useMemo(
    () =>
      memberships.find((membership) => membership.id === selectedMembershipId) ??
      null,
    [memberships, selectedMembershipId],
  );
  const selectedMembershipStatus = selectedMembership
    ? getStatusLabel(selectedMembership.status)
    : null;

  const handleStopClick = () => {
    if (!selectedMembership) {
      return;
    }

    if (selectedMembership.status === "DELETE") {
      setPendingRestoreId(selectedMembership.id);
    } else {
      setPendingDeleteId(selectedMembership.id);
    }
  };

  const filteredTotalPages = Math.max(
    1,
    Math.ceil(memberships.length / PAGE_SIZE),
  );
  const pagedMemberships = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return memberships.slice(start, start + PAGE_SIZE);
  }, [memberships, page]);
  const handlePageChange = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), filteredTotalPages);
    setPage(safePage);
  };

  const handleCreateMembership = async (formData: FormData) => {
    await createMembership(formData);
    setIsCreateOpen(false);
    startTransition(() => {
      router.refresh();
    });
  };

  const handleDeleteMembership = async (formData: FormData) => {
    await deleteMembership(formData);
    setPendingDeleteId(null);
    startTransition(() => {
      router.refresh();
    });
  };

  const handleRestoreMembership = async (formData: FormData) => {
    await restoreMembership(formData);
    setPendingRestoreId(null);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="content">
      <header className="page-header">
        <div>
          <h1>회원권 관리</h1>
        </div>
        <div className="header-actions">
          <span className="count">{countLabel}</span>
          <button
            className="button-primary"
            type="button"
            onClick={() => setIsCreateOpen((prev) => !prev)}
          >
            신규 회원권 등록
          </button>
        </div>
      </header>

      {isCreateOpen && (
        <div className="modal-overlay" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="panel-header">
              <h2>신규 회원권 등록</h2>
              <button
                className="button-ghost"
                type="button"
                onClick={() => setIsCreateOpen(false)}
              >
                닫기
              </button>
            </div>
            <form action={handleCreateMembership}>
              <div className="grid">
                <div>
                  <label htmlFor="duration">유효기간 (개월)</label>
                  <input
                    id="duration"
                    name="duration"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="예: 1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="weeklyAttendance">
                    주간 출석 가능 횟수
                  </label>
                  <input
                    id="weeklyAttendance"
                    name="weeklyAttendance"
                    type="number"
                    min={1}
                    placeholder="예: 3"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="price">가격</label>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    min={0}
                    placeholder="예: 150000"
                    required
                  />
                </div>
              </div>
              <button className="button-primary" type="submit">
                등록하기
              </button>
            </form>
          </div>
        </div>
      )}

      <section className="panel list-panel">
        <div className="panel-header">
          <h2>회원권 목록</h2>
          <div className="pagination">
            <button
              className="button-ghost"
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            >
              이전
            </button>
            <span className="pagination-status">
              {page} / {filteredTotalPages}
            </span>
            <button
              className="button-ghost"
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === filteredTotalPages}
            >
              다음
            </button>
          </div>
        </div>
        {memberships.length === 0 ? (
          <p className="empty">아직 등록된 회원권이 없어요.</p>
        ) : (
          <div className="table-wrap">
            <table className="member-table">
              <thead>
                <tr>
                  <th className="number">회원권 번호</th>
                  <th>유효기간</th>
                  <th>주간 출석 횟수</th>
                  <th>가격</th>
                  <th>등록일</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {pagedMemberships.map((membership) => {
                  const statusInfo = getStatusLabel(membership.status);
                  return (
                    <tr
                      key={membership.id}
                      className={
                        selectedMembershipId === membership.id
                          ? "row active"
                          : "row"
                      }
                      onClick={() =>
                        setSelectedMembershipId((prev) =>
                          prev === membership.id ? null : membership.id,
                        )
                      }
                    >
                      <td className="number">{membership.id}</td>
                      <td>{membership.duration}개월</td>
                      <td>{membership.weeklyAttendance}회</td>
                      <td>{formatPrice(membership.price)}</td>
                      <td>
                        {new Date(membership.createdAt).toLocaleDateString(
                          "ko-KR",
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-label${
                            statusInfo.isDeleted ? " is-deleted" : ""
                          }`}
                        >
                          {statusInfo.isDeleted && (
                            <span aria-hidden="true">⛔</span>
                          )}
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className={`panel detail-panel${selectedMembership ? " is-open" : ""}`}
      >
        {selectedMembership && (
          <>
            <div className="panel-header">
              <h2>회원권 상세</h2>
              <div className="panel-actions">
                <button
                  className={
                    selectedMembership.status === "DELETE"
                      ? "button-primary"
                      : "button-danger"
                  }
                  type="button"
                  onClick={handleStopClick}
                >
                  {selectedMembership.status === "DELETE" ? "복구" : "중지"}
                </button>
              </div>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">회원권 번호</span>
                <strong>{selectedMembership.id}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">유효기간</span>
                <strong>{selectedMembership.duration}개월</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">주간 출석 횟수</span>
                <strong>{selectedMembership.weeklyAttendance}회</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">가격</span>
                <strong>{formatPrice(selectedMembership.price)}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">등록일</span>
                <strong>
                  {new Date(selectedMembership.createdAt).toLocaleDateString(
                    "ko-KR",
                  )}
                </strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">상태</span>
                <strong>
                  {selectedMembershipStatus && (
                    <span
                      className={`status-label${
                        selectedMembershipStatus.isDeleted ? " is-deleted" : ""
                      }`}
                    >
                      {selectedMembershipStatus.isDeleted && (
                        <span aria-hidden="true">⛔</span>
                      )}
                      {selectedMembershipStatus.label}
                    </span>
                  )}
                </strong>
              </div>
            </div>
          </>
        )}
      </section>

      {pendingDeleteId !== null && (
        <div className="modal-overlay" role="presentation">
          <div className="modal confirm-modal" role="dialog" aria-modal="true">
            <p className="confirm-message">
              선택한 회원권을 중지할까요? 중지 후에는 복구할 수 없습니다.
            </p>
            <div className="panel-actions center">
              <button
                className="button-secondary"
                type="button"
                onClick={() => setPendingDeleteId(null)}
              >
                취소
              </button>
              <form
                action={handleDeleteMembership}
              >
                <input type="hidden" name="id" value={pendingDeleteId} />
                <button className="button-danger" type="submit">
                  중지하기
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {pendingRestoreId !== null && (
        <div className="modal-overlay" role="presentation">
          <div className="modal confirm-modal" role="dialog" aria-modal="true">
            <p className="confirm-message">
              선택한 회원권을 복구할까요? 복구 후에는 정상 상태로 전환됩니다.
            </p>
            <div className="panel-actions center">
              <button
                className="button-secondary"
                type="button"
                onClick={() => setPendingRestoreId(null)}
              >
                취소
              </button>
              <form action={handleRestoreMembership}>
                <input type="hidden" name="id" value={pendingRestoreId} />
                <button className="button-primary" type="submit">
                  복구하기
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipPage;
