import { prisma } from "@/lib/prisma";
import AttendancePage from "@/app/components/AttendancePage";
import LockerPage from "@/app/components/LockerPage";
import MarketingPage from "@/app/components/MarketingPage";
import MemberPage from "@/app/components/MemberPage";
import MembershipPage from "@/app/components/MembershipPage";
import SalesPage from "@/app/components/SalesPage";
import AttendanceStatsPage from "@/app/components/AttendanceStatsPage";
import Sidebar from "@/app/components/Sidebar";

type MembershipActivity = {
  type: string;
  createdAt: Date;
  metadata: string | null;
};

type MarketingTargetMember = {
  id: number;
  name: string;
  phone: string;
  memberMemberships: {
    assignedAt: Date;
    expiresAt: Date | null;
    totalPausedMs: number;
  }[];
  activities: MembershipActivity[];
};

const getMembershipExpiryDate = (
  assignedAt: Date,
  duration: number,
  durationUnit: "MONTH" | "DAY",
) => {
  const expiresAt = new Date(assignedAt);

  if (durationUnit === "DAY") {
    expiresAt.setDate(expiresAt.getDate() + Math.max(duration - 1, 0));
    expiresAt.setHours(23, 59, 59, 999);
    return expiresAt;
  }

  expiresAt.setMonth(expiresAt.getMonth() + duration);
  return expiresAt;
};

const parseActivityMetadata = (metadata: string | null) => {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const resolveCurrentMembershipExpiry = (
  memberMemberships: MarketingTargetMember["memberMemberships"],
) => {
  const latestMembership = memberMemberships.reduce(
    (latest, current) =>
      !latest || current.assignedAt > latest.assignedAt ? current : latest,
    null as MarketingTargetMember["memberMemberships"][number] | null,
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

  return adjustedExpiry;
};

const analyzeMarketingMember = (
  member: MarketingTargetMember,
  now: Date,
) => {
  const chronologicalActivities = [...member.activities].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  let resolvedExpiry: Date | null = null;
  let lastKnownExpiry: Date | null = null;
  let expiredHistoryCount = 0;
  let reRegisteredCount = 0;

  chronologicalActivities.forEach((activity) => {
    const metadata = parseActivityMetadata(activity.metadata);

    if (activity.type === "membership_assigned") {
      const assignedAtValue = metadata?.assignedAt;
      const durationValue = metadata?.duration;
      const durationUnitValue = metadata?.durationUnit;
      const assignedAt =
        typeof assignedAtValue === "string" ? new Date(assignedAtValue) : null;
      const duration =
        typeof durationValue === "number" ? durationValue : Number(durationValue);
      const durationUnit =
        durationUnitValue === "DAY"
          ? "DAY"
          : durationUnitValue === "MONTH"
            ? "MONTH"
            : null;

      if (
        resolvedExpiry &&
        assignedAt &&
        !Number.isNaN(assignedAt.getTime()) &&
        assignedAt.getTime() > resolvedExpiry.getTime()
      ) {
        expiredHistoryCount += 1;
        reRegisteredCount += 1;
      }

      if (
        assignedAt &&
        !Number.isNaN(assignedAt.getTime()) &&
        Number.isFinite(duration) &&
        durationUnit
      ) {
        resolvedExpiry = getMembershipExpiryDate(assignedAt, duration, durationUnit);
        lastKnownExpiry = resolvedExpiry;
      }

      return;
    }

    if (activity.type === "membership_expired") {
      const expiredAtValue = metadata?.expiredAt;
      const expiredAt =
        typeof expiredAtValue === "string" ? new Date(expiredAtValue) : null;

      if (expiredAt && !Number.isNaN(expiredAt.getTime())) {
        resolvedExpiry = expiredAt;
        lastKnownExpiry = expiredAt;
      }

      return;
    }

    if (activity.type === "membership_extended") {
      const nextExpiryValue = metadata?.nextExpiry;
      const nextExpiry =
        typeof nextExpiryValue === "string" ? new Date(nextExpiryValue) : null;

      if (nextExpiry && !Number.isNaN(nextExpiry.getTime())) {
        resolvedExpiry = nextExpiry;
        lastKnownExpiry = nextExpiry;
      }

      return;
    }

    if (activity.type === "membership_resumed" && resolvedExpiry) {
      const pausedDurationMsValue = metadata?.pausedDurationMs;
      const pausedDurationMs =
        typeof pausedDurationMsValue === "number"
          ? pausedDurationMsValue
          : Number(pausedDurationMsValue);

      if (Number.isFinite(pausedDurationMs) && pausedDurationMs > 0) {
        resolvedExpiry = new Date(resolvedExpiry.getTime() + pausedDurationMs);
        lastKnownExpiry = resolvedExpiry;
      }

      return;
    }

    if (activity.type === "membership_revoked") {
      resolvedExpiry = null;
    }
  });

  const currentExpiry = resolveCurrentMembershipExpiry(member.memberMemberships);
  if (currentExpiry) {
    lastKnownExpiry = currentExpiry;
  }

  const isCurrentlyExpired =
    !!lastKnownExpiry && lastKnownExpiry.getTime() < now.getTime();

  if (isCurrentlyExpired) {
    expiredHistoryCount += 1;
  }

  return {
    currentExpiry,
    lastKnownExpiry,
    expiredHistoryCount,
    reRegisteredCount,
    isCurrentlyExpired,
  };
};

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
  const isLockerSection = section === "locker";
  const isMarketingSection = section === "marketing";
  const isSalesSection = section === "sales";
  const attendanceStart = new Date();
  attendanceStart.setHours(0, 0, 0, 0);
  attendanceStart.setDate(attendanceStart.getDate() - 13);
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  const [
    members,
    memberships,
    attendanceMembers,
    marketingMembers,
    todayNewMembers,
    totalMembersWithMembership,
    lockerSlots,
    lockerCandidates,
  ] =
    await Promise.all([
      isMarketingSection || isSalesSection || isLockerSection
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
      isMarketingSection || isSalesSection || isLockerSection
        ? Promise.resolve([])
        : prisma.membership.findMany({
            orderBy: {
              createdAt: "desc",
            },
          }),
      isAttendanceSection || isAttendanceStatsSection
        ? prisma.member.findMany({
            where: {
              status: "ACTIVE",
              memberMemberships: {
                some: {
                  pausedAt: null,
                  assignedAt: {
                    lte: now,
                  },
                },
              },
            },
            include: {
              memberMemberships: {
                where: {
                  pausedAt: null,
                  assignedAt: {
                    lte: now,
                  },
                },
                orderBy: {
                  assignedAt: "desc",
                },
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
            },
            include: {
              memberMemberships: {
                select: {
                  assignedAt: true,
                  expiresAt: true,
                  totalPausedMs: true,
                },
              },
              activities: {
                where: {
                  type: {
                    in: [
                      "membership_assigned",
                      "membership_expired",
                      "membership_extended",
                      "membership_resumed",
                      "membership_revoked",
                    ],
                  },
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
      isLockerSection
        ? prisma.lockerSlot.findMany({
            orderBy: {
              lockerNumber: "asc",
            },
            include: {
              member: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        : Promise.resolve([]),
  isLockerSection
        ? prisma.member.findMany({
            where: {
              status: {
                not: "DELETE",
              },
            },
            select: {
              id: true,
              name: true,
              birthDate: true,
            },
            orderBy: {
              name: "asc",
            },
          })
        : Promise.resolve([]),
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
        attendanceTime: activity.createdAt.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
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
  const toLockerDateString = (value: Date | null) => {
    if (!value) {
      return null;
    }
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const lockerSlotMap = new Map(
    lockerSlots.map((lockerSlot) => [lockerSlot.lockerNumber, lockerSlot]),
  );
  const serializedLockerSlots = Array.from({ length: 66 }, (_, index) => {
    const lockerNumber = index + 1;
    const lockerSlot = lockerSlotMap.get(lockerNumber);
    if (!lockerSlot) {
      return {
        lockerNumber,
        memberId: null,
        memberName: null,
        assignedAt: null,
        expiresAt: null,
      };
    }
    return {
      lockerNumber: lockerSlot.lockerNumber,
      memberId: lockerSlot.memberId,
      memberName: lockerSlot.member?.name ?? null,
      assignedAt: toLockerDateString(lockerSlot.assignedAt),
      expiresAt: toLockerDateString(lockerSlot.expiresAt),
    };
  });
  const serializedLockerMembers = lockerCandidates.map((member) => ({
    id: member.id,
    name: member.name,
    birthDate: member.birthDate?.toISOString().slice(0, 10) ?? null,
  }));
  const typedMarketingMembers = marketingMembers as MarketingTargetMember[];
  const analyzedMarketingMembers = typedMarketingMembers.map((member) => ({
    member,
    analysis: analyzeMarketingMember(member, now),
  }));
  const marketingTargets = typedMarketingMembers
    .map((member) => {
      const resolvedExpiry = resolveCurrentMembershipExpiry(member.memberMemberships);

      if (!resolvedExpiry) {
        return null;
      }

      return {
        id: member.id,
        name: member.name,
        phone: member.phone,
        expiresAt: resolvedExpiry.toISOString(),
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
  const expiredMarketingMembers = analyzedMarketingMembers
    .map(({ member, analysis }) => {
      if (
        !analysis.lastKnownExpiry ||
        Number.isNaN(analysis.lastKnownExpiry.getTime()) ||
        !analysis.isCurrentlyExpired
      ) {
        return null;
      }

      if (analysis.lastKnownExpiry.getTime() >= today.getTime()) {
        return null;
      }

      const reRegistrationRate =
        analysis.expiredHistoryCount > 0
          ? Math.round(
              (analysis.reRegisteredCount / analysis.expiredHistoryCount) * 100,
            )
          : 0;

      return {
        id: member.id,
        name: member.name,
        phone: member.phone,
        expiresAt: analysis.lastKnownExpiry.toISOString(),
        reRegistrationRate,
        reRegisteredCount: analysis.reRegisteredCount,
        expiredHistoryCount: analysis.expiredHistoryCount,
      };
    })
    .filter(
      (
        member,
      ): member is {
        id: number;
        name: string;
        phone: string;
        expiresAt: string;
        reRegistrationRate: number;
        reRegisteredCount: number;
        expiredHistoryCount: number;
      } =>
        member !== null,
    )
    .sort(
      (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
    );
  const reRegistrationSummary = analyzedMarketingMembers.reduce(
    (summary, { analysis }) => {
      return {
        expiredHistoryCount:
          summary.expiredHistoryCount + analysis.expiredHistoryCount,
        reRegisteredCount:
          summary.reRegisteredCount + analysis.reRegisteredCount,
        currentlyExpiredCount: analysis.isCurrentlyExpired
          ? summary.currentlyExpiredCount + 1
          : summary.currentlyExpiredCount,
      };
    },
    {
      expiredHistoryCount: 0,
      reRegisteredCount: 0,
      currentlyExpiredCount: 0,
    },
  );
  const reRegistrationRate =
    reRegistrationSummary.expiredHistoryCount > 0
      ? Math.round(
          (reRegistrationSummary.reRegisteredCount /
            reRegistrationSummary.expiredHistoryCount) *
            100,
        )
      : 0;

  return (
    <main className="page">
      <Sidebar />

      {section === "membership" ? (
        <MembershipPage memberships={serializedMemberships} />
      ) : section === "attendance" ? (
        <AttendancePage members={serializedAttendanceMembers} />
      ) : section === "attendance-stats" ? (
        <AttendanceStatsPage members={serializedAttendanceMembers} />
      ) : section === "locker" ? (
        <LockerPage lockers={serializedLockerSlots} members={serializedLockerMembers} />
      ) : section === "marketing" ? (
        <MarketingPage
          buckets={marketingBuckets}
          expiredMembers={expiredMarketingMembers}
          reRegistrationRate={reRegistrationRate}
          reRegisteredCount={reRegistrationSummary.reRegisteredCount}
          expiredHistoryCount={reRegistrationSummary.expiredHistoryCount}
          currentlyExpiredCount={reRegistrationSummary.currentlyExpiredCount}
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
