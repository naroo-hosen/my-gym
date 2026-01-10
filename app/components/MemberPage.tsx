"use client";

import { useMemo, useState } from "react";
import { createMember } from "@/app/actions";
import PhoneInput from "@/app/components/PhoneInput";

type Member = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
};

type MemberPageProps = {
  members: Member[];
};

const PAGE_SIZE = 8;

const MemberPage = ({ members }: MemberPageProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const countLabel = useMemo(() => `총 ${members.length}명`, [members.length]);
  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );
  const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  const pagedMembers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return members.slice(start, start + PAGE_SIZE);
  }, [members, page]);
  const handlePageChange = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(safePage);
  };

  return (
    <div className="content">
      <header className="page-header">
        <div>
          <h1>회원 관리</h1>
          <p>복싱 체육관 회원 정보를 간단하게 관리합니다.</p>
        </div>
        <div className="header-actions">
          <span className="count">{countLabel}</span>
          <button
            className="button-primary"
            type="button"
            onClick={() => setIsCreateOpen((prev) => !prev)}
          >
            신규 회원 등록
          </button>
        </div>
      </header>

      {isCreateOpen && (
        <div className="modal-overlay" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="panel-header">
              <h2>신규 회원 등록</h2>
              <button
                className="button-ghost"
                type="button"
                onClick={() => setIsCreateOpen(false)}
              >
                닫기
              </button>
            </div>
            <form action={createMember} onSubmit={() => setIsCreateOpen(false)}>
              <div className="grid">
                <div>
                  <label htmlFor="name">이름</label>
                  <input id="name" name="name" placeholder="홍길동" required />
                </div>
                <div>
                  <label htmlFor="phone">전화번호</label>
                  <PhoneInput
                    id="phone"
                    name="phone"
                    placeholder="010-1234-5678"
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
          <h2>회원 목록</h2>
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
              {page} / {totalPages}
            </span>
            <button
              className="button-ghost"
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
            >
              다음
            </button>
          </div>
        </div>
        {members.length === 0 ? (
          <p className="empty">아직 등록된 회원이 없어요.</p>
        ) : (
          <div className="table-wrap">
            <table className="member-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>전화번호</th>
                  <th>등록일</th>
                </tr>
              </thead>
              <tbody>
                {pagedMembers.map((member) => (
                  <tr
                    key={member.id}
                    className={
                      selectedMemberId === member.id ? "row active" : "row"
                    }
                    onClick={() =>
                      setSelectedMemberId((prev) =>
                        prev === member.id ? null : member.id,
                      )
                    }
                  >
                    <td>{member.name}</td>
                    <td>{member.phone}</td>
                    <td>
                      {new Date(member.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className={`panel detail-panel${selectedMember ? " is-open" : ""}`}
      >
        {selectedMember && (
          <>
            <div className="panel-header">
              <h2>회원 상세</h2>
              <button className="button-secondary" type="button">
                수정
              </button>
            </div>
            <div className="detail-grid">
              <div>
                <span className="detail-label">이름</span>
                <strong>{selectedMember.name}</strong>
              </div>
              <div>
                <span className="detail-label">전화번호</span>
                <strong>{selectedMember.phone}</strong>
              </div>
              <div>
                <span className="detail-label">등록일</span>
                <strong>
                  {new Date(selectedMember.createdAt).toLocaleDateString("ko-KR")}
                </strong>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default MemberPage;
