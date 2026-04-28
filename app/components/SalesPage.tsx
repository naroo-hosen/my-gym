"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type SalesEntry = {
  id: number;
  type: "income" | "expense";
  date: string;
  amount: number;
  title: string;
  description: string;
  paymentMethod: string | null;
  installmentMonths: number | null;
};

type SalesViewType = "all" | SalesEntry["type"];

type SalesCalendarDay = {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
};

type PaymentMethodSummary = {
  paymentMethod: string;
  income: number;
  expense: number;
};

const PAYMENT_METHOD_OPTIONS = [
  "계좌이체",
  "카드",
  "포항사랑상품권",
  "스포츠바우처",
  "현금",
  "네이버페이",
  "기타",
] as const;

const getInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createDefaultRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: getInputDate(start),
    end: getInputDate(end),
  };
};

const getMonthRange = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: getInputDate(start),
    end: getInputDate(end),
  };
};

const getMonthInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const toMonthDate = (value: string) => {
  const parsed = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const buildCalendarDays = (monthValue: string): SalesCalendarDay[] => {
  const monthDate = toMonthDate(monthValue);
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return {
      date,
      dateKey: getInputDate(date),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
};

const formatMonthLabel = (monthValue: string) =>
  toMonthDate(monthValue).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });

const toDate = (value: string, endOfDay = false) => {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59" : "T00:00:00";
  const parsed = new Date(`${value}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("ko-KR").format(amount);

const getInstallmentLabel = (installmentMonths: number | null) => {
  if (installmentMonths === null) return "-";
  return installmentMonths === 0 ? "일시불" : `${installmentMonths}개월`;
};

const SalesPage = () => {
  const defaultRange = useMemo(() => createDefaultRange(), []);
  const [entries, setEntries] = useState<SalesEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SalesEntry | null>(null);
  const [type, setType] = useState<SalesEntry["type"]>("income");
  const [date, setDate] = useState(getInputDate(new Date()));
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "" | (typeof PAYMENT_METHOD_OPTIONS)[number]
  >("");
  const [customPaymentMethod, setCustomPaymentMethod] = useState("");
  const [installmentMonths, setInstallmentMonths] = useState("0");
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [calendarMonth, setCalendarMonth] = useState(
    getMonthInputValue(new Date()),
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(
    getInputDate(new Date()),
  );
  const [query, setQuery] = useState("");
  const [viewType, setViewType] = useState<SalesViewType>("all");

  const resolvedPaymentMethod =
    paymentMethod === "기타" ? customPaymentMethod.trim() : paymentMethod.trim();
  const requiresCustomPaymentMethod = paymentMethod === "기타";
  const isCardPayment = paymentMethod === "카드";

  const resetForm = () => {
    setEditingId(null);
    setType("income");
    setDate(getInputDate(new Date()));
    setAmount("");
    setTitle("");
    setDescription("");
    setPaymentMethod("");
    setCustomPaymentMethod("");
    setInstallmentMonths("0");
  };

  useEffect(() => {
    let isMounted = true;

    const loadEntries = async () => {
      try {
        const response = await fetch("/api/sales");
        if (!response.ok) {
          throw new Error("Failed to load sales entries");
        }
        const data = (await response.json()) as SalesEntry[];
        if (isMounted) {
          setEntries(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadEntries();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (paymentMethod !== "기타") {
      setCustomPaymentMethod("");
    }
    if (paymentMethod !== "카드") {
      setInstallmentMonths("0");
    }
  }, [paymentMethod]);

  const filteredEntries = useMemo(() => {
    const start = toDate(startDate);
    const end = toDate(endDate, true);
    const term = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const entryDate = toDate(entry.date);
      if (!entryDate) return false;
      if (start && entryDate < start) return false;
      if (end && entryDate > end) return false;
      if (viewType !== "all" && entry.type !== viewType) return false;
      if (!term) return true;
      return (
        entry.title.toLowerCase().includes(term) ||
        entry.description.toLowerCase().includes(term) ||
        (entry.paymentMethod ?? "").toLowerCase().includes(term)
      );
    });
  }, [entries, startDate, endDate, query, viewType]);

  const stats = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        if (entry.type === "income") {
          acc.income += entry.amount;
        } else {
          acc.expense += entry.amount;
        }
        return acc;
      },
      { income: 0, expense: 0 },
    );
  }, [filteredEntries]);

  const netTotal = stats.income - stats.expense;
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth),
    [calendarMonth],
  );
  const dailySales = useMemo(() => {
    return filteredEntries.reduce((map, entry) => {
      const current = map.get(entry.date) ?? { income: 0, expense: 0 };
      if (entry.type === "income") {
        current.income += entry.amount;
      } else {
        current.expense += entry.amount;
      }
      map.set(entry.date, current);
      return map;
    }, new Map<string, { income: number; expense: number }>());
  }, [filteredEntries]);
  const selectedDatePaymentSummary = useMemo(() => {
    const summary = filteredEntries
      .filter((entry) => entry.date === selectedCalendarDate)
      .reduce((map, entry) => {
        const key = entry.paymentMethod || "미지정";
        const current = map.get(key) ?? {
          paymentMethod: key,
          income: 0,
          expense: 0,
        };
        if (entry.type === "income") {
          current.income += entry.amount;
        } else {
          current.expense += entry.amount;
        }
        map.set(key, current);
        return map;
      }, new Map<string, PaymentMethodSummary>());

    return Array.from(summary.values()).sort((first, second) => {
      const firstTotal = first.income - first.expense;
      const secondTotal = second.income - second.expense;
      return secondTotal - firstTotal;
    });
  }, [filteredEntries, selectedCalendarDate]);
  const selectedDateSummaryTotal = useMemo(
    () =>
      selectedDatePaymentSummary.reduce(
        (total, item) => ({
          income: total.income + item.income,
          expense: total.expense + item.expense,
        }),
        { income: 0, expense: 0 },
      ),
    [selectedDatePaymentSummary],
  );

  const handleCalendarMonthChange = (nextMonth: string) => {
    const monthDate = toMonthDate(nextMonth);
    const nextRange = getMonthRange(monthDate);
    setCalendarMonth(getMonthInputValue(monthDate));
    setStartDate(nextRange.start);
    setEndDate(nextRange.end);
  };

  const moveCalendarMonth = (offset: number) => {
    const monthDate = toMonthDate(calendarMonth);
    monthDate.setMonth(monthDate.getMonth() + offset);
    handleCalendarMonthChange(getMonthInputValue(monthDate));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const numericAmount = Number(amount);
    if (
      !date ||
      !title.trim() ||
      Number.isNaN(numericAmount) ||
      !resolvedPaymentMethod
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/sales", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          type,
          date,
          amount: Math.abs(numericAmount),
          title: title.trim(),
          description: description.trim(),
          paymentMethod: resolvedPaymentMethod,
          installmentMonths: isCardPayment ? Number(installmentMonths) : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save sales entry");
      }

      const saved = (await response.json()) as SalesEntry;
      if (editingId) {
        setEntries((prev) =>
          prev.map((entry) => (entry.id === saved.id ? saved : entry)),
        );
      } else {
        setEntries((prev) => [saved, ...prev]);
      }
      resetForm();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (entry: SalesEntry) => {
    setEditingId(entry.id);
    setType(entry.type);
    setDate(entry.date);
    setAmount(String(entry.amount));
    setTitle(entry.title);
    setDescription(entry.description);
    if (!entry.paymentMethod) {
      setPaymentMethod("");
      setCustomPaymentMethod("");
    } else if (
      PAYMENT_METHOD_OPTIONS.includes(
        entry.paymentMethod as (typeof PAYMENT_METHOD_OPTIONS)[number],
      )
    ) {
      setPaymentMethod(
        entry.paymentMethod as (typeof PAYMENT_METHOD_OPTIONS)[number],
      );
      setCustomPaymentMethod("");
    } else {
      setPaymentMethod("기타");
      setCustomPaymentMethod(entry.paymentMethod);
    }
    setInstallmentMonths(String(entry.installmentMonths ?? 0));
  };

  const handleDeleteConfirm = async (entryId: number) => {
    if (deletingId) return;

    setDeletingId(entryId);
    try {
      const response = await fetch(`/api/sales?id=${entryId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete sales entry");
      }

      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  const handleDeleteClick = (entry: SalesEntry) => {
    setPendingDelete(entry);
  };

  const handleDeleteCancel = () => {
    if (deletingId) return;
    setPendingDelete(null);
  };

  return (
    <section className="sales">
      <header className="sales-header">
        <div>
          <h2>매출 관리</h2>
          <p className="sales-subtitle">
            수입/지출 항목을 직접 입력하고, 기간별 매출 통계를 확인하세요.
          </p>
        </div>
      </header>

      <div className="sales-grid">
        <div className="sales-entry-column">
        <section className="panel">
          <div className="panel-header">
            <h3>매출 항목 입력</h3>
            <span className="count">총 {entries.length}건</span>
          </div>
          <form className="sales-form" onSubmit={handleSubmit}>
            <div className="sales-form-row">
              <div>
                <label htmlFor="sales-type">구분</label>
                <select
                  id="sales-type"
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as SalesEntry["type"])
                  }
                >
                  <option value="income">수입</option>
                  <option value="expense">지출</option>
                </select>
              </div>
              <div>
                <label htmlFor="sales-date">날짜</label>
                <input
                  id="sales-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="sales-amount">금액</label>
              <input
                id="sales-amount"
                type="number"
                min="0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="금액을 입력하세요"
                required
              />
            </div>
            <div>
              <label htmlFor="sales-title">항목명</label>
              <input
                id="sales-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="예: 1:1 PT 등록"
                required
              />
            </div>
            <div>
              <label htmlFor="sales-payment-method">결제수단</label>
              <select
                id="sales-payment-method"
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value as "" | (typeof PAYMENT_METHOD_OPTIONS)[number],
                  )
                }
                required
              >
                <option value="">선택하세요</option>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            {requiresCustomPaymentMethod ? (
              <div>
                <label htmlFor="sales-payment-method-custom">
                  기타 결제수단
                </label>
                <input
                  id="sales-payment-method-custom"
                  value={customPaymentMethod}
                  onChange={(event) => setCustomPaymentMethod(event.target.value)}
                  placeholder="결제수단을 직접 입력하세요"
                  required
                />
              </div>
            ) : null}
            {isCardPayment ? (
              <div>
                <label htmlFor="sales-installment-months">할부 개월 수</label>
                <input
                  id="sales-installment-months"
                  type="number"
                  min="0"
                  value={installmentMonths}
                  onChange={(event) => setInstallmentMonths(event.target.value)}
                  placeholder="일시불은 0 입력"
                  required
                />
              </div>
            ) : null}
            <div>
              <label htmlFor="sales-description">설명</label>
              <textarea
                id="sales-description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="결제 방법, 담당자 등 상세 정보를 입력하세요"
              />
            </div>
            <div className="sales-form-actions">
              {editingId ? (
                <button
                  className="button-secondary"
                  type="button"
                  onClick={resetForm}
                  disabled={isSubmitting}
                >
                  수정 취소
                </button>
              ) : null}
              <button
                className="button-primary"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "저장 중..."
                  : editingId
                    ? "항목 수정"
                    : "항목 추가"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>일별 순매출</h3>
            <span className="count">{formatMonthLabel(calendarMonth)}</span>
          </div>
          <div className="sales-calendar">
            <div className="sales-calendar-header">
              <button
                type="button"
                className="button-secondary button-small"
                onClick={() => moveCalendarMonth(-1)}
              >
                이전달
              </button>
              <strong>{formatMonthLabel(calendarMonth)}</strong>
              <button
                type="button"
                className="button-secondary button-small"
                onClick={() => moveCalendarMonth(1)}
              >
                다음달
              </button>
            </div>
            <div className="sales-calendar-weekdays" aria-hidden="true">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="sales-calendar-grid">
              {calendarDays.map((day) => {
                const daily = dailySales.get(day.dateKey);
                const income = daily?.income ?? 0;
                const expense = daily?.expense ?? 0;
                const net = income - expense;

                return (
                  <button
                    type="button"
                    key={day.dateKey}
                    className={`sales-calendar-day${
                      day.isCurrentMonth ? "" : " is-muted"
                    }${income || expense ? " has-sales" : ""}${
                      selectedCalendarDate === day.dateKey ? " is-selected" : ""
                    }`}
                    onClick={() => setSelectedCalendarDate(day.dateKey)}
                  >
                    <span className="sales-calendar-date">
                      {day.date.getDate()}
                    </span>
                    {income || expense ? (
                      <div className="sales-calendar-amounts">
                        <strong className={net >= 0 ? "income" : "expense"}>
                          {net >= 0 ? "+" : "-"}
                          {formatCurrency(Math.abs(net))}원
                        </strong>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="sales-calendar-detail">
              <div className="sales-calendar-detail-header">
                <strong>{selectedCalendarDate}</strong>
                <span>
                  순매출{" "}
                  {selectedDateSummaryTotal.income >=
                  selectedDateSummaryTotal.expense
                    ? "+"
                    : "-"}
                  {formatCurrency(
                    Math.abs(
                      selectedDateSummaryTotal.income -
                        selectedDateSummaryTotal.expense,
                    ),
                  )}
                  원
                </span>
              </div>
              {selectedDatePaymentSummary.length ? (
                <div className="sales-payment-summary-list">
                  {selectedDatePaymentSummary.map((item) => {
                    const net = item.income - item.expense;
                    return (
                      <div
                        key={item.paymentMethod}
                        className="sales-payment-summary-item"
                      >
                        <span>{item.paymentMethod}</span>
                        <strong className={net >= 0 ? "income" : "expense"}>
                          {net >= 0 ? "+" : "-"}
                          {formatCurrency(Math.abs(net))}원
                        </strong>
                        <small>
                          수입 {formatCurrency(item.income)}원 · 지출{" "}
                          {formatCurrency(item.expense)}원
                        </small>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="detail-empty">
                  선택한 날짜에 등록된 매출 항목이 없습니다.
                </p>
              )}
            </div>
          </div>
        </section>
        </div>

        <section className="panel">
          <div className="panel-header">
            <h3>매출 조회</h3>
            <span className="count">
              {isLoading ? "불러오는 중..." : `${filteredEntries.length}건`}
            </span>
          </div>
          <div
            className="sales-view-filters"
            role="tablist"
            aria-label="매출 구분 보기"
          >
            <button
              type="button"
              className={`sales-view-tab ${
                viewType === "all" ? "active" : "button-secondary"
              }`}
              onClick={() => setViewType("all")}
            >
              전체
            </button>
            <button
              type="button"
              className={`sales-view-tab ${
                viewType === "income" ? "active" : "button-secondary"
              }`}
              onClick={() => setViewType("income")}
            >
              수입만
            </button>
            <button
              type="button"
              className={`sales-view-tab ${
                viewType === "expense" ? "active" : "button-secondary"
              }`}
              onClick={() => setViewType("expense")}
            >
              지출만
            </button>
          </div>
          <div className="sales-filters">
            <div>
              <label htmlFor="sales-start">시작일</label>
              <input
                id="sales-start"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  if (event.target.value) {
                    setCalendarMonth(event.target.value.slice(0, 7));
                  }
                }}
              />
            </div>
            <div>
              <label htmlFor="sales-end">종료일</label>
              <input
                id="sales-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <div className="sales-search">
              <label htmlFor="sales-query">검색</label>
              <input
                id="sales-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="항목명/설명 검색"
              />
            </div>
          </div>

          <div className="sales-summary">
            <div className="sales-summary-item">
              <span className="label">총 수입</span>
              <strong className="income">+{formatCurrency(stats.income)}원</strong>
            </div>
            <div className="sales-summary-item">
              <span className="label">총 지출</span>
              <strong className="expense">-{formatCurrency(stats.expense)}원</strong>
            </div>
            <div className="sales-summary-item">
              <span className="label">순이익</span>
              <strong className={netTotal >= 0 ? "income" : "expense"}>
                {netTotal >= 0 ? "+" : "-"}
                {formatCurrency(Math.abs(netTotal))}원
              </strong>
            </div>
          </div>

          <div className="table-wrap">
            <table className="member-table sales-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>구분</th>
                  <th className="number">금액</th>
                  <th>항목명</th>
                  <th>결제수단</th>
                  <th>할부</th>
                  <th>설명</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length ? (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="row">
                      <td>{entry.date}</td>
                      <td>
                        <span
                          className={`sales-type ${
                            entry.type === "income" ? "income" : "expense"
                          }`}
                        >
                          {entry.type === "income" ? "수입" : "지출"}
                        </span>
                      </td>
                      <td className="number">
                        {entry.type === "income" ? "+" : "-"}
                        {formatCurrency(entry.amount)}원
                      </td>
                      <td>{entry.title}</td>
                      <td>{entry.paymentMethod || "-"}</td>
                      <td>{getInstallmentLabel(entry.installmentMonths)}</td>
                      <td className="sales-description">
                        {entry.description || "-"}
                      </td>
                      <td>
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => handleEditClick(entry)}
                          disabled={deletingId === entry.id}
                        >
                          수정
                        </button>
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => handleDeleteClick(entry)}
                          disabled={deletingId === entry.id}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="empty">
                      해당 기간에 등록된 매출 항목이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {pendingDelete ? (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <h3>매출 항목 삭제</h3>
            <p className="confirm-message">
              "{pendingDelete.title}" 항목을 정말 삭제할까요? 삭제하면 복구할 수
              없습니다.
            </p>
            <div className="sales-form-actions">
              <button
                className="button-secondary"
                type="button"
                onClick={handleDeleteCancel}
                disabled={deletingId !== null}
              >
                취소
              </button>
              <button
                className="button-primary"
                type="button"
                onClick={() => handleDeleteConfirm(pendingDelete.id)}
                disabled={deletingId !== null}
              >
                {deletingId === pendingDelete.id ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default SalesPage;
