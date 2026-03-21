"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type LockerMember = {
  id: number;
  name: string;
  birthDate: string | null;
};

type LockerSlot = {
  lockerNumber: number;
  memberId: number | null;
  memberName: string | null;
  assignedAt: string | null;
  expiresAt: string | null;
};

type LockerSlotApiResponse = LockerSlot & {
  section?: string | null;
};

type LockerPageProps = {
  lockers: LockerSlot[];
  members: LockerMember[];
};

const toLocalDateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const getTodayInput = () => {
  const today = new Date();
  return toLocalDateString(today);
};

const addDays = (dateString: string, dayOffset: number) => {
  const base = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(base.getTime())) {
    return getTodayInput();
  }
  const next = new Date(base);
  next.setDate(next.getDate() + dayOffset);
  return toLocalDateString(next);
};

const toDateInput = (value: string | null) =>
  value?.slice(0, 10).match(/^\d{4}-\d{2}-\d{2}$/) ? value.slice(0, 10) : "";

const parseDate = (value: string) => {
  const withTime = value.includes("T") ? value : `${value}T00:00:00`;
  const parsed = new Date(withTime);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getRemainingDays = (value: string | null) => {
  if (!value) {
    return null;
  }
  const normalizedEnd = parseDate(`${value.slice(0, 10)}T23:59:59`);
  if (!normalizedEnd) {
    return null;
  }
  const now = new Date();
  const remainingMs = normalizedEnd.getTime() - now.getTime();
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return remainingDays > 0 ? remainingDays : 0;
};

const normalize = (value: string) => value.trim().toLowerCase();

const lockerSections = [
  { key: "main", title: "보관함 A", start: 1, count: 48, columns: 16 },
  { key: "small", title: "보관함 B", start: 49, count: 18, columns: 3 },
] as const;

type LockerSection = {
  key: string;
  title: string;
  start: number;
  count: number;
  columns: number;
};

const getSlotLabel = (slot: LockerSlot, section: LockerSection) => {
  if (section.key === "small") {
    return `B-${slot.lockerNumber - section.start + 1}`;
  }

  return `${slot.lockerNumber}`;
};

const getSlotDisplayLabel = (lockerNumber: number) =>
  lockerNumber > 48 ? `B-${lockerNumber - 48}` : `${lockerNumber}`;

const LockerPage = ({ lockers, members }: LockerPageProps) => {
  const [slots, setSlots] = useState<LockerSlot[]>(lockers);
  const [activeLockerSection, setActiveLockerSection] =
    useState<LockerSection["key"]>("main");
  const [activeSlotNumber, setActiveSlotNumber] = useState<number | null>(null);
  const [memberKeyword, setMemberKeyword] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [isMemberListOpen, setIsMemberListOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => getTodayInput());
  const [endDate, setEndDate] = useState(() => addDays(getTodayInput(), 30));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.lockerNumber === activeSlotNumber) ?? null,
    [slots, activeSlotNumber],
  );

  useEffect(() => {
    let mounted = true;
    const normalize = (next: LockerSlotApiResponse[]): LockerSlot[] =>
      next
        .slice()
        .sort((a, b) => a.lockerNumber - b.lockerNumber)
        .map((slot) => ({
          lockerNumber: slot.lockerNumber,
          memberId: slot.memberId,
          memberName: slot.memberName,
          assignedAt: slot.assignedAt,
          expiresAt: slot.expiresAt,
        }));

    const syncSlots = async () => {
      setSlots(lockers);
      try {
        const response = await fetch("/api/lockers", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const next = (await response.json()) as LockerSlotApiResponse[];
        if (mounted) {
          setSlots(normalize(next));
        }
      } catch (error) {
        console.error("보관함 목록 동기화 실패", error);
      }
    };

    syncSlots();

    return () => {
      mounted = false;
    };
  }, [lockers]);

  const isMemberKeywordMatched =
    normalize(memberKeyword) !== "" &&
    Boolean(selectedMemberId) &&
    members.some(
      (member) => member.id === selectedMemberId && normalize(member.name) === normalize(memberKeyword),
    );

  const candidateMembers = useMemo(() => {
    const keyword = normalize(memberKeyword);
    if (!keyword) {
      return members.slice(0, 8);
    }
    return members
      .filter((member) => normalize(member.name).includes(keyword))
      .slice(0, 12);
  }, [members, memberKeyword]);

  const openSlot = (slot: LockerSlot) => {
    const defaultStart = toDateInput(slot.assignedAt) || getTodayInput();
    const defaultEnd = toDateInput(slot.expiresAt) || addDays(defaultStart, 30);

    setActiveSlotNumber(slot.lockerNumber);
    setMemberKeyword(slot.memberName || "");
    setSelectedMemberId(slot.memberId);
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setMessage(null);
    setIsMemberListOpen(false);
  };

  const closeSlot = () => {
    setActiveSlotNumber(null);
    setMemberKeyword("");
    setSelectedMemberId(null);
    setMessage(null);
    setIsMemberListOpen(false);
  };

  const handleMemberKeywordChange = (value: string) => {
    setMemberKeyword(value);
    setSelectedMemberId(null);
    setIsMemberListOpen(true);
  };

  const applyMember = (member: LockerMember) => {
    setMemberKeyword(member.name);
    setSelectedMemberId(member.id);
    setIsMemberListOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedSlot || isSubmitting || !selectedMemberId || !startDate || !endDate) {
      return;
    }

    const normalizedStart = parseDate(startDate);
    const normalizedEnd = parseDate(endDate);
    if (!normalizedStart || !normalizedEnd) {
      setMessage("날짜 형식이 올바르지 않습니다.");
      return;
    }
    if (normalizedEnd < normalizedStart) {
      setMessage("종료일이 시작일보다 빠를 수 없습니다.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/lockers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lockerNumber: selectedSlot.lockerNumber,
          memberId: selectedMemberId,
          startDate,
          endDate,
        }),
      });
      if (!response.ok) {
        throw new Error("저장 요청에 실패했습니다.");
      }

      const saved = (await response.json()) as LockerSlot;
      setSlots((prev) =>
        prev.map((slot) =>
          slot.lockerNumber === saved.lockerNumber
            ? {
                lockerNumber: saved.lockerNumber,
                memberId: saved.memberId,
                memberName: saved.memberName,
                assignedAt: saved.assignedAt,
                expiresAt: saved.expiresAt,
              }
            : slot,
        ),
      );
      closeSlot();
    } catch (error) {
      console.error(error);
      setMessage("저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearSlot = async () => {
    if (!selectedSlot || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/lockers?lockerNumber=${selectedSlot.lockerNumber}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        throw new Error("해제 요청에 실패했습니다.");
      }
      const cleared = (await response.json()) as LockerSlot;
      setSlots((prev) =>
        prev.map((slot) =>
          slot.lockerNumber === cleared.lockerNumber
            ? {
                lockerNumber: cleared.lockerNumber,
                memberId: cleared.memberId,
                memberName: cleared.memberName,
                assignedAt: cleared.assignedAt,
                expiresAt: cleared.expiresAt,
              }
            : slot,
        ),
      );
      closeSlot();
    } catch (error) {
      console.error(error);
      setMessage("연결 해제에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMemberInputInvalid =
    memberKeyword.trim().length > 0 && !isMemberKeywordMatched;

  return (
    <section className="panel list-panel">
      <div className="panel-header">
        <h2 className="section-title">보관함 관리</h2>
      </div>
      <div className="locker-tabs" role="tablist" aria-label="보관함 구획 선택">
        {lockerSections.map((section) => (
          <button
            key={section.key}
            id={`locker-tab-${section.key}`}
            type="button"
            role="tab"
            aria-selected={activeLockerSection === section.key}
            aria-controls={`locker-panel-${section.key}`}
            className={`locker-tab ${activeLockerSection === section.key ? "is-active" : ""}`}
            onClick={() => setActiveLockerSection(section.key)}
          >
            {section.title}
          </button>
        ))}
      </div>
      <div className="locker-section-wrap">
        {lockerSections.map((section) => {
          if (section.key !== activeLockerSection) {
            return null;
          }
          const sectionSlots = slots.filter(
            (slot) =>
              slot.lockerNumber >= section.start &&
              slot.lockerNumber < section.start + section.count,
          );

          return (
            <section
              key={section.key}
              id={`locker-panel-${section.key}`}
              className="locker-section"
              role="tabpanel"
              aria-labelledby={`locker-tab-${section.key}`}
            >
              <div className="locker-grid-wrap">
                <div
                  className={`locker-grid locker-grid-columns-${section.columns}`}
                  role="group"
                  aria-label={section.title}
                >
                  {sectionSlots.map((slot) => {
                    const remainingDays = getRemainingDays(slot.expiresAt);
                    const slotLabel = getSlotLabel(slot, section);
                    return (
                        <button
                          key={slot.lockerNumber}
                          type="button"
                          className={`locker-cell ${
                            slot.memberId
                              ? remainingDays !== null && remainingDays <= 0
                                ? "is-occupied"
                                : "is-occupied-green"
                              : "is-empty"
                          }`}
                          onClick={() => openSlot(slot)}
                          aria-label={`보관함 ${slotLabel} 클릭하여 연결`}
                        >
                        {slot.memberName ? (
                          <>
                            <span className="locker-cell-member">{slot.memberName}</span>
                            <span className="locker-cell-remaining">
                              {remainingDays === null ? "-" : `${remainingDays}일 남음`}
                            </span>
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {selectedSlot ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={closeSlot}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h3 className="section-title">
                보관함 {getSlotDisplayLabel(selectedSlot.lockerNumber)} 연결
              </h3>
            </div>
            <form className="locker-form" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="locker-member">회원명</label>
                <input
                  id="locker-member"
                  className={`locker-member-input ${isMemberInputInvalid ? "is-error" : ""}`.trim()}
                  value={memberKeyword}
                  onChange={(event) => handleMemberKeywordChange(event.target.value)}
                  placeholder="회원명 검색"
                  autoComplete="off"
                />
                {isMemberListOpen && memberKeyword && candidateMembers.length > 0 ? (
                  <div className="locker-member-list">
                    {candidateMembers.map((member) => (
                      <button
                        type="button"
                        key={member.id}
                        className="locker-member-item"
                        onClick={() => applyMember(member)}
                      >
                        {member.name}
                        {member.birthDate ? ` (${member.birthDate})` : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label htmlFor="locker-start-date">사용 시작일자</label>
                <input
                  id="locker-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="locker-end-date">사용 종료일자</label>
                <input
                  id="locker-end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>

              {message ? <p className="detail-helper">{message}</p> : null}

              <div className="panel-actions">
                {selectedSlot.memberId ? (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={clearSlot}
                    disabled={isSubmitting}
                  >
                    연결 해제
                  </button>
                ) : null}
                <button
                  type="button"
                  className="button-secondary"
                  onClick={closeSlot}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="button-primary"
                  disabled={
                    isSubmitting ||
                    !isMemberKeywordMatched ||
                    !startDate ||
                    !endDate
                  }
                >
                  {isSubmitting ? "저장 중" : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default LockerPage;
