import Link from "next/link";

const HomePage = () => {
  return (
    <main>
      <section className="section-hero">
        <div>
          <p className="badge">My Gym</p>
          <h1>관리자 홈</h1>
          <p>회원 등록부터 관리까지 한 화면에서 처리하세요.</p>
          <div className="hero-actions">
            <Link className="button-primary" href="/members">
              회원 관리 바로가기
            </Link>
            <button className="button-secondary" type="button">
              공지사항 작성
            </button>
          </div>
        </div>
        <div className="hero-card">
          <h2>운영 체크리스트</h2>
          <ul>
            <li>오늘 등록된 회원 확인</li>
            <li>휴면 회원 연락 스케줄</li>
            <li>프로모션 메시지 발송</li>
          </ul>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="card highlight">
          <h3>회원 관리</h3>
          <p>이름/전화번호 기반으로 회원 정보를 손쉽게 수정하세요.</p>
          <Link className="text-link" href="/members">
            회원 목록 보기 →
          </Link>
        </div>
        <div className="card">
          <h3>마케팅 센터</h3>
          <p>다음 달 캠페인을 준비하고 메시지 템플릿을 관리하세요.</p>
          <span className="chip">준비 중</span>
        </div>
        <div className="card">
          <h3>운동 스케줄</h3>
          <p>PT 예약과 클래스 일정 알림을 한눈에 확인하세요.</p>
          <span className="chip">준비 중</span>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
