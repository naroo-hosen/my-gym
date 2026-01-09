import MemberForm from "@/app/members/MemberForm";
import { prisma } from "@/lib/prisma";
import { deleteMember } from "@/app/actions";

const MembersPage = async () => {
  const members = await prisma.member.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main>
      <section className="section-hero">
        <div>
          <p className="badge">Member CRM</p>
          <h1>회원 관리</h1>
          <p>이름과 전화번호만으로 회원 정보를 간단하게 관리하세요.</p>
        </div>
        <div className="hero-card">
          <h2>오늘의 요약</h2>
          <div className="hero-metrics">
            <div>
              <strong>{members.length}</strong>
              <span>총 회원</span>
            </div>
            <div>
              <strong>{members.slice(0, 3).length}</strong>
              <span>최근 등록</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <MemberForm mode="create" />
      </section>

      <section>
        <div className="section-title">
          <div>
            <h2>회원 목록</h2>
            <p>등록된 회원 정보를 바로 수정하거나 삭제할 수 있어요.</p>
          </div>
          <span className="chip">총 {members.length}명</span>
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
                <MemberForm mode="update" member={member} />
                <form action={deleteMember} className="actions">
                  <input type="hidden" name="id" value={member.id} />
                  <button className="button-danger" type="submit">
                    삭제
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default MembersPage;
