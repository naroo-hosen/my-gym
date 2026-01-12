"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createMember,
  deleteMember,
  pauseMemberMembership,
  restoreMember,
  resumeMemberMembership,
  updateMember,
} from "@/app/actions";
import PhoneInput from "@/app/components/PhoneInput";

type Member = {
  id: number;
  name: string;
  phone: string;
  birthDate: string | null;
  gender: string | null;
  parentPhone: string | null;
  memo: string | null;
  status: string;
  membershipId: number | null;
  membershipAssignedAt: string | null;
  membershipExpiresAt: string | null;
  membershipDuration: number | null;
  membershipPausedAt: string | null;
  membershipTotalPausedMs: number;
  createdAt: string;
};

type Membership = {
  id: number;
  duration: number;
  weeklyAttendance: number;
  price: number;
  status: string;
  createdAt: string;
};

type MemberPageProps = {
  members: Member[];
  memberships: Membership[];
  searchTerm: string;
  searchField: "name" | "phone";
  membershipFilter: MembershipFilter;
  statusFilters: StatusFilter[];
  section: "member" | "membership";
};

type MembershipFilter = "all" | "with" | "without";
type MembershipFilterOption = "with" | "without";
type StatusFilter = "ACTIVE" | "DELETE" | "PAUSED";
type SortKey =
  | "id"
  | "name"
  | "birthDate"
  | "age"
  | "createdAt"
  | "assignedAt"
  | "expiresAt";

const PAGE_SIZE = 8;
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ACTIVE", label: "정상" },
  { value: "DELETE", label: "중지" },
  { value: "PAUSED", label: "일시정지" },
];

const getAge = (birthDate: string | null) => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
};

const getStatusLabel = (status: string, isPaused: boolean) => {
  if (status === "DELETE") {
    return { label: "중지", isDeleted: true, isPaused: false, icon: "⛔" };
  }
  if (isPaused) {
    return { label: "일시정지", isDeleted: false, isPaused: true, icon: "⏸️" };
  }
  return { label: "정상", isDeleted: false, isPaused: false, icon: null };
};

const formatDateInput = (birthDate: string | null) => {
  if (!birthDate) return "";
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const resolveExpiryDate = (
  expiresAt: string | null,
  assignedAt: string | null,
  durationMonths: number | null,
  totalPausedMs: number,
) => {
  if (expiresAt) {
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    const adjusted = new Date(parsed);
    adjusted.setTime(parsed.getTime() + totalPausedMs);
    return adjusted;
  }
  if (!assignedAt || !durationMonths) {
    return null;
  }
  const startDate = new Date(assignedAt);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }
  const derivedExpiry = new Date(startDate);
  derivedExpiry.setMonth(derivedExpiry.getMonth() + durationMonths);
  derivedExpiry.setTime(derivedExpiry.getTime() + totalPausedMs);
  return derivedExpiry;
};

const getRemainingDays = (
  expiresAt: string | null,
  assignedAt: string | null,
  durationMonths: number | null,
  totalPausedMs: number,
  pausedAt: string | null,
) => {
  const baseExpiryDate = resolveExpiryDate(
    expiresAt,
    assignedAt,
    durationMonths,
    totalPausedMs,
  );
  if (!baseExpiryDate) {
    return null;
  }
  const effectiveNow = pausedAt ? new Date(pausedAt) : new Date();
  if (Number.isNaN(effectiveNow.getTime())) {
    return null;
  }
  const diffMs = baseExpiryDate.getTime() - effectiveNow.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

type EditableField =
  | "name"
  | "phone"
  | "birthDate"
  | "gender"
  | "parentPhone"
  | "memo"
  | "membershipId";

const MemberPage = ({
  members,
  memberships,
  searchTerm,
  searchField,
  membershipFilter,
  statusFilters,
  section,
}: MemberPageProps) => {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingRestoreId, setPendingRestoreId] = useState<number | null>(null);
  const [pendingPauseMemberId, setPendingPauseMemberId] = useState<
    number | null
  >(null);
  const [pendingMembershipAction, setPendingMembershipAction] = useState<{
    type: "assign" | "clear";
    membershipId: string;
  } | null>(null);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [draftSearchTerm, setDraftSearchTerm] = useState(searchTerm);
  const [draftSearchField, setDraftSearchField] = useState(searchField);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [membershipSelections, setMembershipSelections] = useState<
    MembershipFilterOption[]
  >([]);
  const [statusSelections, setStatusSelections] =
    useState<StatusFilter[]>([]);
  const [membershipDraftValue, setMembershipDraftValue] = useState("none");
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "asc" });
  const membershipOptions = useMemo(
    () =>
      memberships
        .filter((membership) => membership.status !== "DELETE")
        .map((membership) => ({
          id: membership.id,
          label: `${membership.duration}개월 · 주 ${membership.weeklyAttendance}회 · ${membership.price.toLocaleString("ko-KR")}원`,
        })),
    [memberships],
  );
  const membershipLabelOptions = useMemo(
    () =>
      memberships.map((membership) => ({
        id: membership.id,
        label: `${membership.duration}개월 · 주 ${membership.weeklyAttendance}회 · ${membership.price.toLocaleString("ko-KR")}원`,
      })),
    [memberships],
  );

  const countLabel = useMemo(
    () => `총 ${members.length}명`,
    [members.length],
  );
  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );
  const pendingPauseMember = useMemo(
    () =>
      pendingPauseMemberId
        ? members.find((member) => member.id === pendingPauseMemberId) ?? null
        : null,
    [members, pendingPauseMemberId],
  );
  const selectedMemberNumber = selectedMember?.id ?? null;
  const selectedMemberStatus = selectedMember
    ? getStatusLabel(
        selectedMember.status,
        Boolean(selectedMember.membershipPausedAt),
      )
    : null;
  const selectedMembershipRemainingDays = useMemo(
    () =>
      getRemainingDays(
        selectedMember?.membershipExpiresAt ?? null,
        selectedMember?.membershipAssignedAt ?? null,
        selectedMember?.membershipDuration ?? null,
        selectedMember?.membershipTotalPausedMs ?? 0,
        selectedMember?.membershipPausedAt ?? null,
      ),
    [
      selectedMember?.membershipExpiresAt,
      selectedMember?.membershipAssignedAt,
      selectedMember?.membershipDuration,
      selectedMember?.membershipPausedAt,
      selectedMember?.membershipTotalPausedMs,
    ],
  );
  const selectedMembershipValue = useMemo(() => {
    if (!selectedMember?.membershipId) {
      return "none";
    }
    return String(selectedMember.membershipId);
  }, [selectedMember?.membershipId]);
  const selectedMembershipLabel = useMemo(() => {
    if (!selectedMember?.membershipId) {
      return "-";
    }
    const option = membershipLabelOptions.find(
      (membership) => membership.id === selectedMember.membershipId,
    );
    return option?.label ?? "중지된 회원권";
  }, [membershipLabelOptions, selectedMember?.membershipId]);
  const isSelectedMembershipInactive = useMemo(() => {
    if (!selectedMember?.membershipId) {
      return false;
    }
    return !membershipOptions.some(
      (membership) => membership.id === selectedMember.membershipId,
    );
  }, [membershipOptions, selectedMember?.membershipId]);
  const canPauseMembership = Boolean(
    selectedMember?.membershipId && selectedMember?.status !== "DELETE",
  );
  const isMembershipPaused = Boolean(selectedMember?.membershipPausedAt);
  const handleStopClick = () => {
    if (!selectedMember) {
      return;
    }

    if (selectedMember.status === "DELETE") {
      setPendingRestoreId(selectedMember.id);
    } else {
      setPendingDeleteId(selectedMember.id);
    }
  };
  const handlePauseClick = () => {
    if (!selectedMember) {
      return;
    }

    setPendingPauseMemberId(selectedMember.id);
  };
  const filteredTotalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  const sortedMembers = useMemo(() => {
    if (!sortConfig.key) {
      return members;
    }
    const sorted = [...members];
    const directionFactor = sortConfig.direction === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      const getSortValue = (member: Member) => {
        switch (sortConfig.key) {
          case "id":
            return member.id;
          case "name":
            return member.name;
          case "birthDate":
            return member.birthDate ? new Date(member.birthDate).getTime() : null;
          case "age":
            return getAge(member.birthDate);
          case "createdAt":
            return new Date(member.createdAt).getTime();
          case "assignedAt":
            return member.membershipAssignedAt
              ? new Date(member.membershipAssignedAt).getTime()
              : null;
          case "expiresAt": {
            const expiryDate = resolveExpiryDate(
              member.membershipExpiresAt,
              member.membershipAssignedAt,
              member.membershipDuration,
              member.membershipTotalPausedMs,
            );
            return expiryDate ? expiryDate.getTime() : null;
          }
          default:
            return null;
        }
      };

      const aValue = getSortValue(a);
      const bValue = getSortValue(b);

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return aValue.localeCompare(bValue) * directionFactor;
      }
      return (Number(aValue) - Number(bValue)) * directionFactor;
    });
    return sorted;
  }, [members, sortConfig]);
  const pagedMembers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedMembers.slice(start, start + PAGE_SIZE);
  }, [page, sortedMembers]);
  const handlePageChange = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), filteredTotalPages);
    setPage(safePage);
  };

  useEffect(() => {
    setEditingField(null);
  }, [selectedMemberId]);

  useEffect(() => {
    if (editingField === "membershipId") {
      setMembershipDraftValue(selectedMembershipValue);
    }
  }, [editingField, selectedMembershipValue]);

  const resolvedStatusSelections = useMemo(() => {
    if (statusFilters.length === 0) {
      return STATUS_OPTIONS.map((option) => option.value);
    }
    return statusFilters;
  }, [statusFilters]);

  useEffect(() => {
    if (membershipFilter === "with") {
      setMembershipSelections(["with"]);
    } else if (membershipFilter === "without") {
      setMembershipSelections(["without"]);
    } else {
      setMembershipSelections(["with", "without"]);
    }
    setStatusSelections(resolvedStatusSelections);
  }, [membershipFilter, resolvedStatusSelections]);

  useEffect(() => {
    setPage(1);
  }, [
    membershipFilter,
    resolvedStatusSelections,
    searchField,
    searchTerm,
    sortConfig,
  ]);

  useEffect(() => {
    if (!selectedMemberId) return;
    const exists = members.some((member) => member.id === selectedMemberId);
    if (!exists) {
      setSelectedMemberId(null);
    }
  }, [members, selectedMemberId]);

  useEffect(() => {
    setDraftSearchTerm(searchTerm);
    setDraftSearchField(searchField);
  }, [searchField, searchTerm]);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const renderSortableHeader = (
    label: string,
    key: SortKey,
    className?: string,
  ) => {
    const isActive = sortConfig.key === key;
    const indicator = isActive
      ? sortConfig.direction === "asc"
        ? "▲"
        : "▼"
      : "↕";
    const ariaSort = isActive
      ? sortConfig.direction === "asc"
        ? "ascending"
        : "descending"
      : "none";
    return (
      <th className={className} aria-sort={ariaSort}>
        <button
          className={`sort-button${isActive ? " is-active" : ""}`}
          type="button"
          onClick={() => handleSort(key)}
        >
          <span>{label}</span>
          <span className="sort-indicator" aria-hidden="true">
            {indicator}
          </span>
        </button>
      </th>
    );
  };

  const buildQueryParams = (
    term: string,
    field: "name" | "phone",
    membership: MembershipFilterOption[],
    statuses: StatusFilter[],
  ) => {
    const params = new URLSearchParams();
    const trimmedTerm = term.trim();

    if (trimmedTerm) {
      params.set("q", trimmedTerm);
    }
    params.set("field", field);

    if (membership.length === 1) {
      params.set("membership", membership[0]);
    }

    const uniqueStatuses = Array.from(new Set(statuses));
    if (uniqueStatuses.length > 0 && uniqueStatuses.length < STATUS_OPTIONS.length) {
      params.set("status", uniqueStatuses.join(","));
    }

    if (section === "membership") {
      params.set("section", "membership");
    }

    return params;
  };

  const pushQuery = (
    term: string,
    field: "name" | "phone",
    membership: MembershipFilterOption[],
    statuses: StatusFilter[],
  ) => {
    const params = buildQueryParams(term, field, membership, statuses);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/?${query}` : "/");
    });
  };

  useEffect(() => {
    if (
      draftSearchTerm === searchTerm &&
      draftSearchField === searchField
    ) {
      return;
    }
    const handler = setTimeout(() => {
      pushQuery(
        draftSearchTerm,
        draftSearchField,
        membershipSelections,
        statusSelections,
      );
    }, 300);

    return () => clearTimeout(handler);
  }, [
    draftSearchField,
    draftSearchTerm,
    router,
    searchField,
    searchTerm,
    startTransition,
  ]);

  const currentMembershipParam =
    membershipSelections.length === 1 ? membershipSelections[0] : "all";
  const currentStatusParam = Array.from(new Set(statusSelections)).sort().join(",");
  const initialStatusParam = Array.from(
    new Set(resolvedStatusSelections),
  )
    .sort()
    .join(",");

  useEffect(() => {
    if (
      (membershipFilter === "all" && currentMembershipParam === "all") ||
      membershipFilter === currentMembershipParam
    ) {
      if (currentStatusParam === initialStatusParam) {
        return;
      }
    }
    pushQuery(
      draftSearchTerm,
      draftSearchField,
      membershipSelections,
      statusSelections,
    );
  }, [
    currentMembershipParam,
    currentStatusParam,
    draftSearchField,
    draftSearchTerm,
    initialStatusParam,
    membershipFilter,
    membershipSelections,
    statusSelections,
  ]);

  const startEdit = (field: EditableField) => {
    setEditingField(field);
  };

  const closeEdit = () => {
    setEditingField(null);
  };

  const handleMembershipSave = () => {
    if (membershipDraftValue === selectedMembershipValue) {
      closeEdit();
      return;
    }
    if (membershipDraftValue === "none") {
      setPendingMembershipAction({
        type: "clear",
        membershipId: "none",
      });
    } else {
      setPendingMembershipAction({
        type: "assign",
        membershipId: membershipDraftValue,
      });
    }
  };

  return (
    <div className="content">
      <header className="page-header">
        <div>
          <h1>회원 관리</h1>
        </div>
        <div className="header-actions">
          <span className="count">{countLabel}</span>
          <button
            className="button-primary"
            type="button"
            onClick={() => setIsCreateOpen((prev) => !prev)}
          >
            신규 회원 등록
          </button>
        </div>
      </header>

      {isCreateOpen && (
        <div className="modal-overlay" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="panel-header">
              <h2>신규 회원 등록</h2>
              <button
                className="button-ghost"
                type="button"
                onClick={() => setIsCreateOpen(false)}
              >
                닫기
              </button>
            </div>
            <form action={createMember} onSubmit={() => setIsCreateOpen(false)}>
              <div className="grid">
                <div>
                  <label htmlFor="name">이름</label>
                  <input id="name" name="name" placeholder="홍길동" required />
                </div>
                <div>
                  <label htmlFor="phone">전화번호</label>
                  <PhoneInput
                    id="phone"
                    name="phone"
                    placeholder="010-1234-5678"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="birthDate">생년월일</label>
                  <input id="birthDate" name="birthDate" type="date" />
                </div>
                <div>
                  <label htmlFor="gender">성별</label>
                  <select id="gender" name="gender" defaultValue="">
                    <option value="">선택</option>
                    <option value="남성">남성</option>
                    <option value="여성">여성</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="parentPhone">부모님 연락처</label>
                  <PhoneInput
                    id="parentPhone"
                    name="parentPhone"
                    placeholder="010-1234-5678"
                  />
                </div>
                <div>
                  <label htmlFor="memo">메모</label>
                  <textarea id="memo" name="memo" rows={3} />
                </div>
              </div>
              <button className="button-primary" type="submit">
                등록하기
              </button>
            </form>
          </div>
        </div>
      )}

      <section className="panel list-panel">
        <div className="panel-header">
          <h2>회원 목록</h2>
          <div className="list-panel-actions">
            <form
              className="search-form"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="filter-wrap">
                <button
                  className="filter-button"
                  type="button"
                  onClick={() => setIsFilterOpen((prev) => !prev)}
                  aria-expanded={isFilterOpen}
                  aria-controls="member-filter-panel"
                >
                  <span className="filter-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                      <path
                        d="M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 .8 1.6l-6.2 8.27V19a1 1 0 0 1-1.45.9l-2.5-1.25a1 1 0 0 1-.55-.9v-3.13L3.2 5.6A1 1 0 0 1 3 5Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                  <span>필터</span>
                </button>
                {isFilterOpen && (
                  <div className="filter-panel" id="member-filter-panel">
                    <div className="filter-group">
                      <span className="filter-title">회원권</span>
                      <label className="filter-option">
                        <input
                          type="checkbox"
                          checked={membershipSelections.includes("with")}
                          onChange={() =>
                            setMembershipSelections((prev) =>
                              prev.includes("with")
                                ? prev.filter((value) => value !== "with")
                                : [...prev, "with"],
                            )
                          }
                        />
                        회원권 있음
                      </label>
                      <label className="filter-option">
                        <input
                          type="checkbox"
                          checked={membershipSelections.includes("without")}
                          onChange={() =>
                            setMembershipSelections((prev) =>
                              prev.includes("without")
                                ? prev.filter((value) => value !== "without")
                                : [...prev, "without"],
                            )
                          }
                        />
                        회원권 없음
                      </label>
                    </div>
                    <div className="filter-group">
                      <span className="filter-title">회원 상태</span>
                      {STATUS_OPTIONS.map((option) => (
                        <label key={option.value} className="filter-option">
                          <input
                            type="checkbox"
                            checked={statusSelections.includes(option.value)}
                            onChange={() =>
                              setStatusSelections((prev) =>
                                prev.includes(option.value)
                                  ? prev.filter((value) => value !== option.value)
                                  : [...prev, option.value],
                              )
                            }
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <select
                className="search-field-select"
                value={draftSearchField}
                onChange={(event) =>
                  setDraftSearchField(
                    event.target.value === "phone" ? "phone" : "name",
                  )
                }
                aria-label="검색 기준"
              >
                <option value="name">이름</option>
                <option value="phone">전화번호</option>
              </select>
              <div className="search-bar">
                <input
                  value={draftSearchTerm}
                  onChange={(event) => setDraftSearchTerm(event.target.value)}
                  placeholder="검색어를 입력하세요"
                  aria-label="검색어 입력"
                />
              </div>
            </form>
            <div className="pagination">
              <button
                className="button-ghost"
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                이전
              </button>
              <span className="pagination-status">
                {page} / {filteredTotalPages}
              </span>
              <button
                className="button-ghost"
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === filteredTotalPages}
              >
                다음
              </button>
            </div>
          </div>
        </div>
        {members.length === 0 ? (
          <p className="empty">
            {searchTerm.trim()
              ? "검색 결과가 없습니다."
              : "아직 등록된 회원이 없어요."}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="member-table">
              <thead>
                <tr>
                  {renderSortableHeader("회원번호", "id", "number")}
                  {renderSortableHeader("이름", "name")}
                  {renderSortableHeader("생년월일", "birthDate")}
                  {renderSortableHeader("나이", "age")}
                  <th>성별</th>
                  <th>부모님 연락처</th>
                  <th>전화번호</th>
                  {renderSortableHeader("등록일", "createdAt")}
                  <th>상태</th>
                  {renderSortableHeader("시작일", "assignedAt")}
                  {renderSortableHeader("만료일", "expiresAt")}
                  <th>남은 기간</th>
                </tr>
              </thead>
              <tbody>
                {pagedMembers.map((member) => {
                  const statusInfo = getStatusLabel(
                    member.status,
                    Boolean(member.membershipPausedAt),
                  );
                  const resolvedExpiryDate = resolveExpiryDate(
                    member.membershipExpiresAt,
                    member.membershipAssignedAt,
                    member.membershipDuration,
                    member.membershipTotalPausedMs,
                  );
                  const expiresAtLabel =
                    member.membershipPausedAt || !resolvedExpiryDate
                      ? "-"
                      : resolvedExpiryDate.toLocaleDateString("ko-KR");
                  const remainingDays = getRemainingDays(
                    member.membershipExpiresAt,
                    member.membershipAssignedAt,
                    member.membershipDuration,
                    member.membershipTotalPausedMs,
                    member.membershipPausedAt,
                  );
                  return (
                    <tr
                      key={member.id}
                      className={
                        selectedMemberId === member.id ? "row active" : "row"
                      }
                      onClick={() =>
                        setSelectedMemberId((prev) =>
                          prev === member.id ? null : member.id,
                        )
                      }
                    >
                      <td className="number">{member.id}</td>
                      <td>{member.name}</td>
                      <td>
                        {member.birthDate
                          ? new Date(member.birthDate).toLocaleDateString("ko-KR")
                          : "-"}
                      </td>
                      <td>{getAge(member.birthDate) ?? "-"}</td>
                      <td>{member.gender || "-"}</td>
                      <td>{member.parentPhone || "-"}</td>
                      <td>{member.phone}</td>
                      <td>
                        {new Date(member.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td>
                        <span
                          className={`status-label${
                            statusInfo.isDeleted
                              ? " is-deleted"
                              : statusInfo.isPaused
                                ? " is-paused"
                                : ""
                          }`}
                        >
                          {statusInfo.icon && (
                            <span aria-hidden="true">{statusInfo.icon}</span>
                          )}
                          {statusInfo.label}
                        </span>
                      </td>
                      <td>
                        {member.membershipAssignedAt
                          ? new Date(
                              member.membershipAssignedAt,
                            ).toLocaleDateString("ko-KR")
                          : "-"}
                      </td>
                      <td>{expiresAtLabel}</td>
                      <td>{remainingDays !== null ? `${remainingDays}일` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className={`panel detail-panel${selectedMember ? " is-open" : ""}`}
      >
        {selectedMember && (
          <>
            <div className="panel-header">
              <h2>회원 상세</h2>
              <div className="panel-actions">
                {canPauseMembership && (
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={handlePauseClick}
                  >
                    {isMembershipPaused ? "일시정지 해제" : "일시정지"}
                  </button>
                )}
                <button
                  className={
                    selectedMember.status === "DELETE"
                      ? "button-primary"
                      : "button-danger"
                  }
                  type="button"
                  onClick={handleStopClick}
                >
                  {selectedMember.status === "DELETE" ? "복구" : "중지"}
                </button>
              </div>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">회원 번호</span>
                <strong>{selectedMemberNumber ?? "-"}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">이름</span>
                {editingField === "name" ? (
                  <form
                    action={updateMember}
                    className="detail-edit-form"
                    onSubmit={closeEdit}
                  >
                    <input type="hidden" name="id" value={selectedMember.id} />
                    <input
                      name="name"
                      defaultValue={selectedMember.name}
                      required
                    />
                    <div className="detail-edit-actions">
                      <button className="button-primary" type="submit">
                        저장
                      </button>
                      <button
                        className="button-ghost"
                        type="button"
                        onClick={closeEdit}
                      >
                        취소
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="detail-value">
                    <strong>{selectedMember.name}</strong>
                    <button
                      className="detail-edit-button"
                      type="button"
                      onClick={() => startEdit("name")}
                      aria-label="이름 수정"
                    >
                      <span aria-hidden="true">✏️</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">전화번호</span>
                {editingField === "phone" ? (
                  <form
                    action={updateMember}
                    className="detail-edit-form"
                    onSubmit={closeEdit}
                  >
                    <input type="hidden" name="id" value={selectedMember.id} />
                    <PhoneInput
                      id="phone-edit"
                      name="phone"
                      defaultValue={selectedMember.phone}
                      required
                    />
                    <div className="detail-edit-actions">
                      <button className="button-primary" type="submit">
                        저장
                      </button>
                      <button
                        className="button-ghost"
                        type="button"
                        onClick={closeEdit}
                      >
                        취소
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="detail-value">
                    <strong>{selectedMember.phone}</strong>
                    <button
                      className="detail-edit-button"
                      type="button"
                      onClick={() => startEdit("phone")}
                      aria-label="전화번호 수정"
                    >
                      <span aria-hidden="true">✏️</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">생년월일</span>
                {editingField === "birthDate" ? (
                  <form
                    action={updateMember}
                    className="detail-edit-form"
                    onSubmit={closeEdit}
                  >
                    <input type="hidden" name="id" value={selectedMember.id} />
                    <input
                      name="birthDate"
                      type="date"
                      defaultValue={formatDateInput(selectedMember.birthDate)}
                    />
                    <div className="detail-edit-actions">
                      <button className="button-primary" type="submit">
                        저장
                      </button>
                      <button
                        className="button-ghost"
                        type="button"
                        onClick={closeEdit}
                      >
                        취소
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="detail-value">
                    <strong>
                      {selectedMember.birthDate
                        ? new Date(selectedMember.birthDate).toLocaleDateString(
                            "ko-KR",
                          )
                        : "-"}
                    </strong>
                    <button
                      className="detail-edit-button"
                      type="button"
                      onClick={() => startEdit("birthDate")}
                      aria-label="생년월일 수정"
                    >
                      <span aria-hidden="true">✏️</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">나이</span>
                <strong>{getAge(selectedMember.birthDate) ?? "-"}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">성별</span>
                {editingField === "gender" ? (
                  <form
                    action={updateMember}
                    className="detail-edit-form"
                    onSubmit={closeEdit}
                  >
                    <input type="hidden" name="id" value={selectedMember.id} />
                    <select
                      name="gender"
                      defaultValue={selectedMember.gender || ""}
                    >
                      <option value="">선택</option>
                      <option value="남성">남성</option>
                      <option value="여성">여성</option>
                      <option value="기타">기타</option>
                    </select>
                    <div className="detail-edit-actions">
                      <button className="button-primary" type="submit">
                        저장
                      </button>
                      <button
                        className="button-ghost"
                        type="button"
                        onClick={closeEdit}
                      >
                        취소
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="detail-value">
                    <strong>{selectedMember.gender || "-"}</strong>
                    <button
                      className="detail-edit-button"
                      type="button"
                      onClick={() => startEdit("gender")}
                      aria-label="성별 수정"
                    >
                      <span aria-hidden="true">✏️</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">부모님 연락처</span>
                {editingField === "parentPhone" ? (
                  <form
                    action={updateMember}
                    className="detail-edit-form"
                    onSubmit={closeEdit}
                  >
                    <input type="hidden" name="id" value={selectedMember.id} />
                    <PhoneInput
                      id="parentPhone-edit"
                      name="parentPhone"
                      defaultValue={selectedMember.parentPhone || ""}
                    />
                    <div className="detail-edit-actions">
                      <button className="button-primary" type="submit">
                        저장
                      </button>
                      <button
                        className="button-ghost"
                        type="button"
                        onClick={closeEdit}
                      >
                        취소
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="detail-value">
                    <strong>{selectedMember.parentPhone || "-"}</strong>
                    <button
                      className="detail-edit-button"
                      type="button"
                      onClick={() => startEdit("parentPhone")}
                      aria-label="부모님 연락처 수정"
                    >
                      <span aria-hidden="true">✏️</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">등록일</span>
                <strong>
                  {new Date(selectedMember.createdAt).toLocaleDateString("ko-KR")}
                </strong>
              </div>
              <div className="detail-item">
                <span className="detail-label">상태</span>
                <strong>
                  {selectedMemberStatus && (
                    <span
                      className={`status-label${
                        selectedMemberStatus.isDeleted
                          ? " is-deleted"
                          : selectedMemberStatus.isPaused
                            ? " is-paused"
                            : ""
                      }`}
                    >
                      {selectedMemberStatus.icon && (
                        <span aria-hidden="true">
                          {selectedMemberStatus.icon}
                        </span>
                      )}
                      {selectedMemberStatus.label}
                    </span>
                  )}
                </strong>
              </div>
              <div className="detail-item detail-item--wide">
                <span className="detail-label">회원권</span>
                {editingField === "membershipId" ? (
                  <form
                    action={updateMember}
                    className="detail-edit-form"
                    onSubmit={closeEdit}
                  >
                    <input type="hidden" name="id" value={selectedMember.id} />
                    <select
                      className="membership-select"
                      name="membershipId"
                      value={membershipDraftValue}
                      onChange={(event) =>
                        setMembershipDraftValue(event.target.value)
                      }
                    >
                      <option value="none">선택 안 함</option>
                      {isSelectedMembershipInactive && selectedMember ? (
                        <option value={selectedMember.membershipId} disabled>
                          {selectedMembershipLabel}
                        </option>
                      ) : null}
                      {membershipOptions.map((membership) => (
                        <option key={membership.id} value={membership.id}>
                          {membership.label}
                        </option>
                      ))}
                    </select>
                    <div className="detail-edit-actions">
                      <button
                        className="button-primary"
                        type="button"
                        onClick={handleMembershipSave}
                      >
                        저장
                      </button>
                      <button
                        className="button-ghost"
                        type="button"
                        onClick={closeEdit}
                      >
                        취소
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="detail-value">
                    <strong>{selectedMembershipLabel}</strong>
                    <button
                      className="detail-edit-button"
                      type="button"
                      onClick={() => startEdit("membershipId")}
                      aria-label="회원권 변경"
                    >
                      <span aria-hidden="true">✏️</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="detail-item detail-item--wide">
                <span className="detail-label">시작일</span>
                <strong>
                  {selectedMember.membershipAssignedAt
                    ? new Date(
                        selectedMember.membershipAssignedAt,
                      ).toLocaleDateString("ko-KR")
                    : "-"}
                </strong>
              </div>
              <div className="detail-item detail-item--wide">
                <span className="detail-label">만료일</span>
                <strong>
                  {selectedMember.membershipPausedAt
                    ? "-"
                    : resolveExpiryDate(
                        selectedMember.membershipExpiresAt,
                        selectedMember.membershipAssignedAt,
                        selectedMember.membershipDuration,
                        selectedMember.membershipTotalPausedMs,
                      )?.toLocaleDateString("ko-KR") ?? "-"}
                </strong>
              </div>
              <div className="detail-item detail-item--wide">
                <span className="detail-label">남은 기간</span>
                <strong>
                  {selectedMembershipRemainingDays !== null
                    ? `${selectedMembershipRemainingDays}일`
                    : "-"}
                </strong>
              </div>
            </div>
            <div className="detail-memo">
              <span className="detail-label">메모</span>
              {editingField === "memo" ? (
                <form
                  action={updateMember}
                  className="detail-edit-form"
                  onSubmit={closeEdit}
                >
                  <input type="hidden" name="id" value={selectedMember.id} />
                  <textarea
                    name="memo"
                    rows={3}
                    defaultValue={selectedMember.memo || ""}
                  />
                  <div className="detail-edit-actions">
                    <button className="button-primary" type="submit">
                      저장
                    </button>
                    <button
                      className="button-ghost"
                      type="button"
                      onClick={closeEdit}
                    >
                      취소
                    </button>
                  </div>
                </form>
              ) : (
                <div className="detail-memo-content">
                  <p>{selectedMember.memo || "-"}</p>
                  <button
                    className="detail-edit-button"
                    type="button"
                    onClick={() => startEdit("memo")}
                    aria-label="메모 수정"
                  >
                    <span aria-hidden="true">✏️</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {pendingDeleteId !== null && (
        <div className="modal-overlay" role="presentation">
          <div className="modal confirm-modal" role="dialog" aria-modal="true">
            <p className="confirm-message">
              선택한 회원을 중지할까요? 중지 후에는 복구할 수 없습니다.
            </p>
            <div className="panel-actions center">
              <button
                className="button-secondary"
                type="button"
                onClick={() => setPendingDeleteId(null)}
              >
                취소
              </button>
              <form
                action={deleteMember}
                onSubmit={() => setPendingDeleteId(null)}
              >
                <input type="hidden" name="id" value={pendingDeleteId} />
                <button className="button-danger" type="submit">
                  중지하기
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {pendingPauseMember && (
        <div className="modal-overlay" role="presentation">
          <div className="modal confirm-modal" role="dialog" aria-modal="true">
            <p className="confirm-message">
              {pendingPauseMember.membershipPausedAt
                ? "일시정지를 해제할까요? 해제하면 오늘부터 다시 차감됩니다."
                : "회원권을 일시정지할까요? 일시정지 동안 남은 기간이 유지됩니다."}
            </p>
            <div className="panel-actions center">
              <button
                className="button-secondary"
                type="button"
                onClick={() => setPendingPauseMemberId(null)}
              >
                취소
              </button>
              <form
                action={
                  pendingPauseMember.membershipPausedAt
                    ? resumeMemberMembership
                    : pauseMemberMembership
                }
                onSubmit={() => setPendingPauseMemberId(null)}
              >
                <input
                  type="hidden"
                  name="memberId"
                  value={pendingPauseMember.id}
                />
                <button className="button-primary" type="submit">
                  확인
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {pendingMembershipAction && selectedMember && (
        <div className="modal-overlay" role="presentation">
          <div className="modal confirm-modal" role="dialog" aria-modal="true">
            <p className="confirm-message">
              {pendingMembershipAction.type === "assign"
                ? "회원권을 부여하면 지금부터 바로 적용됩니다. 진행할까요?"
                : "회원권 부여를 취소하면 복구할 수 없습니다. 진행할까요?"}
            </p>
            <div className="panel-actions center">
              <button
                className="button-secondary"
                type="button"
                onClick={() => setPendingMembershipAction(null)}
              >
                취소
              </button>
              <form
                action={updateMember}
                onSubmit={() => {
                  setPendingMembershipAction(null);
                  closeEdit();
                }}
              >
                <input type="hidden" name="id" value={selectedMember.id} />
                <input
                  type="hidden"
                  name="membershipId"
                  value={pendingMembershipAction.membershipId}
                />
                <button className="button-primary" type="submit">
                  확인
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {pendingRestoreId !== null && (
        <div className="modal-overlay" role="presentation">
          <div className="modal confirm-modal" role="dialog" aria-modal="true">
            <p className="confirm-message">
              선택한 회원을 복구할까요? 복구 후에는 정상 상태로 전환됩니다.
            </p>
            <div className="panel-actions center">
              <button
                className="button-secondary"
                type="button"
                onClick={() => setPendingRestoreId(null)}
              >
                취소
              </button>
              <form
                action={restoreMember}
                onSubmit={() => setPendingRestoreId(null)}
              >
                <input type="hidden" name="id" value={pendingRestoreId} />
                <button className="button-primary" type="submit">
                  복구하기
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberPage;
