import { prisma } from "@/lib/prisma";
import MemberPage from "@/app/components/MemberPage";
import MembershipPage from "@/app/components/MembershipPage";
import Sidebar from "@/app/components/Sidebar";

type HomePageProps = {
  searchParams?: {
    q?: string;
    field?: string;
    section?: string;
  };
};

const HomePage = async ({ searchParams }: HomePageProps) => {
  const searchTerm =
    typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const searchField = searchParams?.field === "phone" ? "phone" : "name";
  const section = searchParams?.section === "membership" ? "membership" : "member";

  const [members, memberships] = await Promise.all([
    prisma.member.findMany({
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
    }),
    prisma.membership.findMany({
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

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
  const serializedMemberships = memberships.map((membership) => ({
    id: membership.id,
    duration: membership.duration,
    weeklyAttendance: membership.weeklyAttendance,
    price: membership.price,
    status: membership.status,
    createdAt: membership.createdAt.toISOString(),
  }));

  return (
    <main className="page">
      <Sidebar />

      {section === "membership" ? (
        <MembershipPage memberships={serializedMemberships} />
      ) : (
        <MemberPage
          members={serializedMembers}
          searchTerm={searchTerm}
          searchField={searchField}
          section={section}
        />
      )}
    </main>
  );
};

export default HomePage;
