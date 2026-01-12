import { prisma } from "@/lib/prisma";
import MemberPage from "@/app/components/MemberPage";
import Sidebar from "@/app/components/Sidebar";

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
    status: member.status,
    createdAt: member.createdAt.toISOString(),
  }));

  return (
    <main className="page">
      <Sidebar />

      <MemberPage members={serializedMembers} />
    </main>
  );
};

export default HomePage;
