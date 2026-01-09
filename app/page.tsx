import { prisma } from "@/lib/prisma";
import { createMember, deleteMember, updateMember } from "@/app/actions";
import PhoneInput from "@/app/components/PhoneInput";

const HomePage = async () => {
  const members = await prisma.member.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="page">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-badge">GYM</span>
          <div>
            <p className="brand-title">챔피언스 복싱 짐</p>
            <p className="brand-subtitle">관리자 모드</p>
          </div>
        </div>
        <nav className="menu">
          <button className="menu-item active" type="button">
            회원 관리
          </button>
          <button className="menu-item" type="button">
            수업 일정
          </button>
          <button className="menu-item" type="button">
            결제 관리
          </button>
          <button className="menu-item" type="button">
            시설 관리
          </button>
        </nav>
      </aside>

      <div className="content">
        <header className="page-header">
          <div>
            <h1>회원 관리</h1>
            <p>복싱 체육관 회원 정보를 간단하게 관리합니다.</p>
          </div>
          <span className="count">총 {members.length}명</span>
        </header>

        <section className="panel">
          <h2>신규 회원 등록</h2>
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
                      등록일 {member.createdAt.toLocaleDateString("ko-KR")}
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
    </main>
  );
};

export default HomePage;
