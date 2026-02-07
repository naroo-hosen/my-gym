"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type SalesEntry = {
  id: number;
  type: "income" | "expense";
  date: string;
  amount: number;
  title: string;
  description: string;
};

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

const toDate = (value: string, endOfDay = false) => {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59" : "T00:00:00";
  const parsed = new Date(`${value}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("ko-KR").format(amount);

const SalesPage = () => {
  const defaultRange = useMemo(() => createDefaultRange(), []);
  const [entries, setEntries] = useState<SalesEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SalesEntry | null>(null);
  const [type, setType] = useState<SalesEntry["type"]>("income");
  const [date, setDate] = useState(getInputDate(new Date()));
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [query, setQuery] = useState("");

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

  const filteredEntries = useMemo(() => {
    const start = toDate(startDate);
    const end = toDate(endDate, true);
    const term = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const entryDate = toDate(entry.date);
      if (!entryDate) return false;
      if (start && entryDate < start) return false;
      if (end && entryDate > end) return false;
      if (!term) return true;
      return (
        entry.title.toLowerCase().includes(term) ||
        entry.description.toLowerCase().includes(term)
      );
    });
  }, [entries, startDate, endDate, query]);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const numericAmount = Number(amount);
    if (!date || !title.trim() || Number.isNaN(numericAmount)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          date,
          amount: Math.abs(numericAmount),
          title: title.trim(),
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save sales entry");
      }

      const created = (await response.json()) as SalesEntry;
      setEntries((prev) => [created, ...prev]);
      setAmount("");
      setTitle("");
      setDescription("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
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
              <button
                className="button-primary"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "저장 중..." : "항목 추가"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>매출 조회</h3>
            <span className="count">
              {isLoading ? "불러오는 중..." : `${filteredEntries.length}건`}
            </span>
          </div>
          <div className="sales-filters">
            <div>
              <label htmlFor="sales-start">시작일</label>
              <input
                id="sales-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
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
                      <td className="sales-description">
                        {entry.description || "-"}
                      </td>
                      <td>
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
                    <td colSpan={6} className="empty">
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
