"use client";

import { useMemo, useState } from "react";
import { createMember, deleteMember } from "@/app/actions";
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

const MemberPage = ({ members }: MemberPageProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const countLabel = useMemo(() => `총 ${members.length}명`, [members.length]);

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
        <section className="panel">
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
          <form action={createMember}>
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
        </section>
      )}

      <section className="panel list-panel">
        <h2>회원 목록</h2>
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
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    <td>{member.phone}</td>
                    <td>
                      {new Date(member.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td>
                      <form action={deleteMember}>
                        <input type="hidden" name="id" value={member.id} />
                        <button className="button-danger" type="submit">
                          삭제
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default MemberPage;
