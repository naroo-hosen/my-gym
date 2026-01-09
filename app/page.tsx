import { prisma } from "@/lib/prisma";
import { createMember, deleteMember, updateMember } from "@/app/actions";

const HomePage = async () => {
  const members = await prisma.member.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main>
      <header>
        <h1>회원 관리</h1>
        <p>이름과 전화번호로 회원 정보를 간단하게 관리하세요.</p>
      </header>

      <section>
        <h2>신규 회원 등록</h2>
        <form action={createMember}>
          <div className="grid">
            <div>
              <label htmlFor="name">이름</label>
              <input id="name" name="name" placeholder="홍길동" required />
            </div>
            <div>
              <label htmlFor="phone">전화번호</label>
              <input id="phone" name="phone" placeholder="010-1234-5678" required />
            </div>
          </div>
          <button className="button-primary" type="submit">
            등록하기
          </button>
        </form>
      </section>

      <section>
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
                      <input
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
