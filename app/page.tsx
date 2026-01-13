import { prisma } from "@/lib/prisma";
import MemberPage from "@/app/components/MemberPage";
import MembershipPage from "@/app/components/MembershipPage";
import Sidebar from "@/app/components/Sidebar";

type HomePageProps = {
  searchParams?: {
    q?: string;
    field?: string;
    section?: string;
    membership?: string;
    status?: string;
  };
};

const HomePage = async ({ searchParams }: HomePageProps) => {
  const searchTerm =
    typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const searchField = searchParams?.field === "phone" ? "phone" : "name";
  const section = searchParams?.section === "membership" ? "membership" : "member";
  const membershipFilter =
    searchParams?.membership === "with" || searchParams?.membership === "without"
      ? searchParams.membership
      : "all";
  const statusFilterParam =
    typeof searchParams?.status === "string" ? searchParams.status : "";
  const statusFilters = statusFilterParam
    .split(",")
    .map((value) => value.trim())
    .filter(
      (value) => value === "ACTIVE" || value === "DELETE" || value === "PAUSED",
    );

  const statusConditions = statusFilters.length
    ? statusFilters.map((status) => {
        if (status === "DELETE") {
          return { status: "DELETE" as const };
        }
        if (status === "PAUSED") {
          return {
            status: "ACTIVE" as const,
            memberMemberships: {
              some: {
                pausedAt: {
                  not: null,
                },
              },
            },
          };
        }
        return {
          status: "ACTIVE" as const,
          memberMemberships: {
            none: {
              pausedAt: {
                not: null,
              },
            },
          },
        };
      })
    : [];

  const [members, memberships] = await Promise.all([
    prisma.member.findMany({
      where: {
        ...(searchTerm
          ? {
              [searchField]: {
                contains: searchTerm,
              },
            }
          : {}),
        ...(statusConditions.length > 0 ? { OR: statusConditions } : {}),
        ...(membershipFilter === "with"
          ? { memberMemberships: { some: {} } }
          : membershipFilter === "without"
            ? { memberMemberships: { none: {} } }
            : {}),
      },
      include: {
        memberMemberships: {
          include: {
            membership: true,
          },
        },
        activities: {
          orderBy: {
            createdAt: "desc",
          },
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

  const serializedMembers = members.map((member) => {
    const latestMembership = member.memberMemberships.reduce(
      (latest, current) =>
        !latest || current.assignedAt > latest.assignedAt ? current : latest,
      null as (typeof member.memberMemberships)[number] | null,
    );
    return {
      id: member.id,
      name: member.name,
      phone: member.phone,
      birthDate: member.birthDate ? member.birthDate.toISOString() : null,
      gender: member.gender,
      parentPhone: member.parentPhone,
      memo: member.memo,
      status: member.status,
      membershipId: latestMembership?.membershipId ?? null,
      membershipAssignedAt:
        latestMembership?.assignedAt.toISOString() ?? null,
      membershipExpiresAt:
        latestMembership?.expiresAt?.toISOString() ?? null,
      membershipDuration:
        latestMembership?.membership?.duration ?? null,
      membershipDurationUnit:
        latestMembership?.membership?.durationUnit ?? null,
      membershipPausedAt:
        latestMembership?.pausedAt?.toISOString() ?? null,
      membershipTotalPausedMs: latestMembership?.totalPausedMs ?? 0,
      activities: member.activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        description: activity.description,
        metadata: activity.metadata,
        createdAt: activity.createdAt.toISOString(),
      })),
      createdAt: member.createdAt.toISOString(),
    };
  });
  const serializedMemberships = memberships.map((membership) => ({
    id: membership.id,
    duration: membership.duration,
    durationUnit: membership.durationUnit,
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
          memberships={serializedMemberships}
          searchTerm={searchTerm}
          searchField={searchField}
          membershipFilter={membershipFilter}
          statusFilters={statusFilters}
          section={section}
        />
      )}
    </main>
  );
};

export default HomePage;
