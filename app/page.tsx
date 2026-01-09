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
      <header className="hero">
        <nav className="top-nav">
          <div className="brand">
            <span className="brand-badge">BOXING</span>
            <div>
              <p className="brand-title">챔피언스 복싱 짐</p>
              <p className="brand-subtitle">회원 관리 & 스케줄 운영 시스템</p>
            </div>
          </div>
          <ul className="menu">
            <li className="menu-item active">회원 관리</li>
            <li className="menu-item">수업 일정</li>
            <li className="menu-item">결제 관리</li>
          </ul>
        </nav>
        <div className="hero-content">
          <div>
            <h1>링 위의 집중력처럼, 회원 관리는 간결하게.</h1>
            <p>
              복싱 체육관 운영에 필요한 핵심 정보를 한눈에. 신규 회원 등록부터
              연락처 업데이트까지 빠르게 처리하세요.
            </p>
            <div className="hero-actions">
              <span className="badge">이번 달 신규 회원 12명</span>
              <span className="badge">오늘 수업 4개 진행</span>
            </div>
          </div>
          <div className="hero-card">
            <p className="hero-card-title">오늘의 운영 체크리스트</p>
            <ul>
              <li>회원 출석 확인</li>
              <li>수업 예약 현황 점검</li>
              <li>복싱 용품 재고 확인</li>
            </ul>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>신규 회원 등록</h2>
            <p>빠른 입력으로 체육관 회원을 즉시 등록하세요.</p>
          </div>
          <span className="section-tag">메뉴 · 회원 관리</span>
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

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>회원 목록</h2>
            <p>현재 등록된 회원 정보를 한눈에 확인하세요.</p>
          </div>
          <span className="section-tag">총 {members.length}명</span>
        </div>
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
    </main>
  );
};

export default HomePage;
