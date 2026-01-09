"use client";

import { useMemo, useState } from "react";
import { createMember, deleteMember, updateMember } from "@/app/actions";
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

      <section className="panel">
        <h2>회원 목록</h2>
        {members.length === 0 ? (
          <p className="empty">아직 등록된 회원이 없어요.</p>
        ) : (
          <div className="cards">
            {members.map((member) => (
              <div className="card" key={member.id}>
                <div className="card-header">
                  <div>
                    <strong>{member.name}</strong>
                    <div className="meta">{member.phone}</div>
                  </div>
                  <span className="meta">
                    등록일{" "}
                    {new Date(member.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <form action={updateMember}>
                  <input type="hidden" name="id" value={member.id} />
                  <div className="grid">
                    <div>
                      <label htmlFor={`name-${member.id}`}>이름</label>
                      <input
                        id={`name-${member.id}`}
                        name="name"
                        defaultValue={member.name}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor={`phone-${member.id}`}>전화번호</label>
                      <PhoneInput
                        id={`phone-${member.id}`}
                        name="phone"
                        defaultValue={member.phone}
                        required
                      />
                    </div>
                  </div>
                  <div className="actions">
                    <button className="button-secondary" type="submit">
                      수정 저장
                    </button>
                  </div>
                </form>
                <form action={deleteMember}>
                  <input type="hidden" name="id" value={member.id} />
                  <div className="actions">
                    <button className="button-danger" type="submit">
                      삭제
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default MemberPage;
