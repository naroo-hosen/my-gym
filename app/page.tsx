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
      include: {
        memberMemberships: {
          include: {
            membership: true,
          },
          orderBy: {
            assignedAt: "desc",
          },
          take: 1,
        },
      },
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
    membershipId: member.memberMemberships[0]?.membershipId ?? null,
    membershipAssignedAt:
      member.memberMemberships[0]?.assignedAt.toISOString() ?? null,
    membershipDuration:
      member.memberMemberships[0]?.membership?.duration ?? null,
    membershipPausedAt:
      member.memberMemberships[0]?.pausedAt?.toISOString() ?? null,
    membershipTotalPausedMs: member.memberMemberships[0]?.totalPausedMs ?? 0,
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
          memberships={serializedMemberships.filter(
            (membership) => membership.status !== "DELETE",
          )}
          searchTerm={searchTerm}
          searchField={searchField}
          section={section}
        />
      )}
    </main>
  );
};

export default HomePage;
