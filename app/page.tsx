import { prisma } from "@/lib/prisma";
import MemberPage from "@/app/components/MemberPage";
import Sidebar from "@/app/components/Sidebar";

type HomePageProps = {
  searchParams?: {
    q?: string;
    field?: string;
  };
};

const HomePage = async ({ searchParams }: HomePageProps) => {
  const searchTerm =
    typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const searchField = searchParams?.field === "phone" ? "phone" : "name";

  const members = await prisma.member.findMany({
    where: searchTerm
      ? {
          [searchField]: {
            contains: searchTerm,
          },
        }
      : undefined,
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

      <MemberPage
        members={serializedMembers}
        searchTerm={searchTerm}
        searchField={searchField}
      />
    </main>
  );
};

export default HomePage;
