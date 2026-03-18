import { prisma } from "@/lib/prisma";
import AttendancePage from "@/app/components/AttendancePage";
import EquipmentPage from "@/app/components/EquipmentPage";
import LockerPage from "@/app/components/LockerPage";
import MarketingPage from "@/app/components/MarketingPage";
import MemberPage from "@/app/components/MemberPage";
import MembershipPage from "@/app/components/MembershipPage";
import SalesPage from "@/app/components/SalesPage";
import AttendanceStatsPage from "@/app/components/AttendanceStatsPage";
import Sidebar from "@/app/components/Sidebar";

type HomePageProps = {
  searchParams?: {
    q?: string;
    field?: string;
    section?: string;
    membership?: string;
    status?: string;
    memberId?: string;
  };
};

const HomePage = async ({ searchParams }: HomePageProps) => {
  const searchTerm =
    typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const searchField =
    searchParams?.field === "phone"
      ? "phone"
      : searchParams?.field === "memo"
        ? "memo"
        : "name";
  const section =
    searchParams?.section === "membership"
      ? "membership"
      : searchParams?.section === "attendance"
        ? "attendance"
        : searchParams?.section === "attendance-stats"
          ? "attendance-stats"
          : searchParams?.section === "equipment"
            ? "equipment"
            : searchParams?.section === "locker"
              ? "locker"
        : searchParams?.section === "marketing"
          ? "marketing"
          : searchParams?.section === "sales"
            ? "sales"
        : "member";
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
  const selectedMemberId =
    typeof searchParams?.memberId === "string" &&
    !Number.isNaN(Number(searchParams.memberId))
      ? Number(searchParams.memberId)
      : null;

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

  const isAttendanceSection = section === "attendance";
  const isAttendanceStatsSection = section === "attendance-stats";
  const isEquipmentSection = section === "equipment";
  const isLockerSection = section === "locker";
  const isMarketingSection = section === "marketing";
  const isSalesSection = section === "sales";
  const attendanceStart = new Date();
  attendanceStart.setHours(0, 0, 0, 0);
  attendanceStart.setDate(attendanceStart.getDate() - 13);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  const [
    members,
    memberships,
    equipments,
    attendanceMembers,
    marketingMembers,
    todayNewMembers,
    totalMembersWithMembership,
  ] =
    await Promise.all([
      isMarketingSection || isSalesSection || isEquipmentSection || isLockerSection
        ? Promise.resolve([])
        : prisma.member.findMany({
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
      isMarketingSection || isSalesSection || isEquipmentSection || isLockerSection
        ? Promise.resolve([])
        : prisma.membership.findMany({
            orderBy: {
              createdAt: "desc",
            },
          }),
      isEquipmentSection
        ? prisma.equipment.findMany({
            where: {
              status: {
                not: "DELETE",
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          })
        : Promise.resolve([]),
      isAttendanceSection || isAttendanceStatsSection
        ? prisma.member.findMany({
            where: {
              status: "ACTIVE",
              memberMemberships: {
                some: {
                  pausedAt: null,
                },
              },
            },
            include: {
              memberMemberships: {
                include: {
                  membership: true,
                },
              },
              activities: {
                where: {
                  type: "attendance_checked",
                  ...(isAttendanceStatsSection ? {} : { createdAt: { gte: attendanceStart } }),
                },
                orderBy: {
                  createdAt: "desc",
                },
              },
            },
            orderBy: {
              name: "asc",
            },
          })
        : Promise.resolve([]),
      isMarketingSection
        ? prisma.member.findMany({
            where: {
              status: "ACTIVE",
              memberMemberships: {
                some: {
                  expiresAt: {
                    not: null,
                  },
                },
              },
            },
            include: {
              memberMemberships: {
                include: {
                  membership: true,
                },
              },
            },
            orderBy: {
              name: "asc",
            },
          })
        : Promise.resolve([]),
      isMarketingSection
        ? prisma.member.count({
            where: {
              createdAt: {
                gte: todayStart,
                lt: tomorrowStart,
              },
            },
          })
        : Promise.resolve(0),
      isMarketingSection
        ? prisma.member.count({
            where: {
              status: "ACTIVE",
              memberMemberships: {
                some: {},
              },
            },
          })
        : Promise.resolve(0),
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
          latestMembership?.membership
              ? ((latestMembership.membership.durationUnit === "DAY"
                  ? "DAY"
                  : "MONTH") as "DAY" | "MONTH")
              : null,
      membershipWeeklyAttendance:
        latestMembership?.membership?.weeklyAttendance ?? null,
      membershipPausedAt:
        latestMembership?.pausedAt?.toISOString() ?? null,
      membershipPauseEndsAt:
        latestMembership?.pauseEndsAt?.toISOString() ?? null,
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
  const serializedAttendanceMembers = attendanceMembers.map((member) => {
    const activeMembership = member.memberMemberships[0];
    return {
      id: member.id,
      name: member.name,
      birthDate: member.birthDate ? member.birthDate.toISOString() : null,
      phone: member.phone,
      membershipDuration: activeMembership?.membership?.duration ?? null,
        membershipDurationUnit: activeMembership?.membership
        ? ((activeMembership.membership.durationUnit === "DAY" ? "DAY" : "MONTH") as "DAY" | "MONTH")
        : null,
      membershipWeeklyAttendance:
        activeMembership?.membership?.weeklyAttendance ?? null,
      membershipAssignedAt:
        activeMembership?.assignedAt.toISOString() ?? null,
      activities: member.activities.map((activity) => ({
        createdAt: activity.createdAt.toISOString(),
      })),
    };
  });
  const serializedMemberships = memberships.map((membership) => ({
    id: membership.id,
    duration: membership.duration,
      durationUnit: (membership.durationUnit === "DAY" ? "DAY" : "MONTH") as "DAY" | "MONTH",
    weeklyAttendance: membership.weeklyAttendance,
    price: membership.price,
    status: membership.status,
    createdAt: membership.createdAt.toISOString(),
  }));
  const serializedEquipments = equipments.map((equipment) => ({
    id: equipment.id,
    name: equipment.name,
    price: equipment.price,
    status: equipment.status,
    createdAt: equipment.createdAt.toISOString(),
  }));
  const marketingTargets = marketingMembers
    .map((member) => {
      const latestMembership = member.memberMemberships.reduce(
        (latest, current) =>
          !latest || current.assignedAt > latest.assignedAt ? current : latest,
        null as (typeof member.memberMemberships)[number] | null,
      );
      if (!latestMembership?.expiresAt) {
        return null;
      }
      const adjustedExpiry = new Date(latestMembership.expiresAt);
      if (Number.isNaN(adjustedExpiry.getTime())) {
        return null;
      }
      adjustedExpiry.setTime(
        adjustedExpiry.getTime() + (latestMembership.totalPausedMs ?? 0),
      );
      return {
        id: member.id,
        name: member.name,
        phone: member.phone,
        expiresAt: adjustedExpiry.toISOString(),
      };
    })
    .filter(
      (
        member,
      ): member is { id: number; name: string; phone: string; expiresAt: string } =>
        member !== null,
    );
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const marketingBuckets = [7, 3, 1, 0].map((days) => ({
    days,
    label: days === 0 ? "만료 당일" : `만료 ${days}일 전`,
    members: [] as {
      id: number;
      name: string;
      phone: string;
      expiresAt: string;
    }[],
  }));

  marketingTargets.forEach((member) => {
    const expiresAt = new Date(member.expiresAt);
    expiresAt.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (expiresAt.getTime() - today.getTime()) / MS_PER_DAY,
    );
    const bucket = marketingBuckets.find((item) => item.days === diffDays);
    if (bucket) {
      bucket.members.push(member);
    }
  });

  marketingBuckets.forEach((bucket) => {
    bucket.members.sort(
      (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
    );
  });

  return (
    <main className="page">
      <Sidebar />

      {section === "membership" ? (
        <MembershipPage memberships={serializedMemberships} />
      ) : section === "attendance" ? (
        <AttendancePage members={serializedAttendanceMembers} />
      ) : section === "attendance-stats" ? (
        <AttendanceStatsPage members={serializedAttendanceMembers} />
      ) : section === "equipment" ? (
        <EquipmentPage equipments={serializedEquipments} />
      ) : section === "locker" ? (
        <LockerPage />
      ) : section === "marketing" ? (
        <MarketingPage
          buckets={marketingBuckets}
          todayNewMembers={todayNewMembers}
          totalMembersWithMembership={totalMembersWithMembership}
        />
      ) : section === "sales" ? (
        <SalesPage />
      ) : (
        <MemberPage
          members={serializedMembers}
          memberships={serializedMemberships}
          searchTerm={searchTerm}
          searchField={searchField}
          membershipFilter={membershipFilter}
          statusFilters={statusFilters}
          section={section}
          selectedMemberId={selectedMemberId}
        />
      )}
    </main>
  );
};

export default HomePage;
