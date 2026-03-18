"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createEquipment,
  deleteEquipment,
  updateEquipment,
} from "@/app/actions";

type Equipment = {
  id: number;
  name: string;
  price: number;
  status: string;
  createdAt: string;
};

type EquipmentPageProps = {
  equipments: Equipment[];
};

const PAGE_SIZE = 8;

const formatPrice = (price: number) => `${price.toLocaleString("ko-KR")}원`;

const getStatusLabel = (status: string) => {
  if (status === "DELETE") {
    return { label: "삭제됨", isDeleted: true };
  }

  return { label: "정상", isDeleted: false };
};

const EquipmentPage = ({ equipments }: EquipmentPageProps) => {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const countLabel = useMemo(
    () => `총 ${equipments.length}개`,
    [equipments.length],
  );
  const totalPages = Math.max(1, Math.ceil(equipments.length / PAGE_SIZE));
  const pagedEquipments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return equipments.slice(start, start + PAGE_SIZE);
  }, [equipments, page]);
  const selectedEquipment = useMemo(
    () =>
      equipments.find((equipment) => equipment.id === selectedEquipmentId) ??
      null,
    [equipments, selectedEquipmentId],
  );
  const selectedStatus = selectedEquipment
    ? getStatusLabel(selectedEquipment.status)
    : null;

  const refreshPage = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handlePageChange = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(safePage);
  };

  const handleCreateEquipment = async (formData: FormData) => {
    const result = await createEquipment(formData);

    if (result?.status === "invalid") {
      alert("장비명과 가격을 올바르게 입력해 주세요.");
      return;
    }

    setIsCreateOpen(false);
    refreshPage();
  };

  const handleUpdateEquipment = async (formData: FormData) => {
    const result = await updateEquipment(formData);

    if (result?.status === "invalid") {
      alert("장비명과 가격을 올바르게 입력해 주세요.");
      return;
    }

    refreshPage();
  };

  const handleDeleteEquipment = async (formData: FormData) => {
    const result = await deleteEquipment(formData);

    if (result?.status === "invalid") {
      alert("잘못된 요청입니다.");
      setPendingDeleteId(null);
      return;
    }

    setPendingDeleteId(null);
    refreshPage();
  };

  return (
    <div className="content">
      <header className="page-header">
        <div>
          <h1>장비 관리</h1>
          <p>장비를 등록하고, 상세 정보 수정과 soft delete를 처리합니다.</p>
        </div>
        <div className="header-actions">
          <span className="count">{countLabel}</span>
          <button
            className="button-primary"
            type="button"
            onClick={() => setIsCreateOpen((prev) => !prev)}
          >
            신규 장비 등록
          </button>
        </div>
      </header>

      {isCreateOpen && (
        <div className="modal-overlay" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="panel-header">
              <h2>신규 장비 등록</h2>
              <button
                className="button-ghost"
                type="button"
                onClick={() => setIsCreateOpen(false)}
              >
                닫기
              </button>
            </div>
            <form action={handleCreateEquipment} className="equipment-form">
              <div className="grid">
                <div>
                  <label htmlFor="equipment-name">장비명</label>
                  <input
                    id="equipment-name"
                    name="name"
                    placeholder="예: 글러브"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="equipment-price">가격</label>
                  <input
                    id="equipment-price"
                    name="price"
                    type="number"
                    min={0}
                    placeholder="예: 45000"
                    required
                  />
                </div>
              </div>
              <div className="equipment-form-actions">
                <button className="button-primary" type="submit">
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="equipment-layout">
        <section className="panel list-panel">
          <div className="panel-header">
            <h2>장비 목록</h2>
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
                {page} / {totalPages}
              </span>
              <button
                className="button-ghost"
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
              >
                다음
              </button>
            </div>
          </div>
          {equipments.length === 0 ? (
            <p className="empty">아직 등록된 장비가 없어요.</p>
          ) : (
            <div className="table-wrap">
              <table className="member-table">
                <thead>
                  <tr>
                    <th className="number">번호</th>
                    <th>장비명</th>
                    <th>가격</th>
                    <th>상태</th>
                    <th>등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedEquipments.map((equipment) => {
                    const statusInfo = getStatusLabel(equipment.status);
                    return (
                      <tr
                        key={equipment.id}
                        className={
                          selectedEquipmentId === equipment.id
                            ? "row active"
                            : "row"
                        }
                        onClick={() =>
                          setSelectedEquipmentId((prev) =>
                            prev === equipment.id ? null : equipment.id,
                          )
                        }
                      >
                        <td className="number">{equipment.id}</td>
                        <td>{equipment.name}</td>
                        <td>{formatPrice(equipment.price)}</td>
                        <td>
                          <span
                            className={`status-label${
                              statusInfo.isDeleted ? " is-deleted" : ""
                            }`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td>
                          {new Date(equipment.createdAt).toLocaleDateString(
                            "ko-KR",
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          className={`panel detail-panel${selectedEquipment ? " is-open" : ""}`}
        >
          {selectedEquipment ? (
            <>
              <div className="panel-header">
                <h2>장비 상세</h2>
                <div className="panel-actions">
                  <button
                    className="button-danger"
                    type="button"
                    onClick={() => setPendingDeleteId(selectedEquipment.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>

              <form action={handleUpdateEquipment} className="equipment-form">
                <input type="hidden" name="id" value={selectedEquipment.id} />
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">장비 번호</span>
                    <strong>{selectedEquipment.id}</strong>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">상태</span>
                    <strong>
                      {selectedStatus && (
                        <span
                          className={`status-label${
                            selectedStatus.isDeleted ? " is-deleted" : ""
                          }`}
                        >
                          {selectedStatus.label}
                        </span>
                      )}
                    </strong>
                  </div>
                </div>

                <div className="grid">
                  <div>
                    <label htmlFor="selected-equipment-name">장비명</label>
                    <input
                      id="selected-equipment-name"
                      name="name"
                      defaultValue={selectedEquipment.name}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="selected-equipment-price">가격</label>
                    <input
                      id="selected-equipment-price"
                      name="price"
                      type="number"
                      min={0}
                      defaultValue={selectedEquipment.price}
                      required
                    />
                  </div>
                </div>

                <div className="equipment-form-meta">
                  등록일:{" "}
                  {new Date(selectedEquipment.createdAt).toLocaleDateString(
                    "ko-KR",
                  )}
                </div>

                <div className="equipment-form-actions">
                  <button className="button-primary" type="submit">
                    수정 저장
                  </button>
                </div>
              </form>
            </>
          ) : (
            <p className="empty">목록에서 장비를 선택하면 상세 정보를 수정할 수 있어요.</p>
          )}
        </section>
      </div>

      {pendingDeleteId !== null && (
        <div className="modal-overlay" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="panel-header">
              <h2>장비 삭제</h2>
            </div>
            <p>장비를 삭제 처리할까요? 실제 데이터는 남고 상태만 변경됩니다.</p>
            <form action={handleDeleteEquipment}>
              <input type="hidden" name="id" value={pendingDeleteId} />
              <div className="modal-actions">
                <button
                  className="button-ghost"
                  type="button"
                  onClick={() => setPendingDeleteId(null)}
                >
                  취소
                </button>
                <button className="button-danger" type="submit">
                  삭제 처리
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentPage;
