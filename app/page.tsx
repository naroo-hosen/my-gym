import { prisma } from "@/lib/prisma";
import MemberPage from "@/app/components/MemberPage";

const HomePage = async () => {
  const members = await prisma.member.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  const serializedMembers = members.map((member) => ({
    id: member.id,
    name: member.name,
    phone: member.phone,
    birthDate: member.birthDate ? member.birthDate.toISOString() : null,
    gender: member.gender,
    parentPhone: member.parentPhone,
    memo: member.memo,
    createdAt: member.createdAt.toISOString(),
  }));

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

      <MemberPage members={serializedMembers} />
    </main>
  );
};

export default HomePage;
