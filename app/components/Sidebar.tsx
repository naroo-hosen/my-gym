"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const Sidebar = () => {
  const [isMembersOpen, setIsMembersOpen] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
const section =
  searchParams.get("section") === "membership"
    ? "membership"
    : searchParams.get("section") === "attendance"
      ? "attendance"
      : searchParams.get("section") === "attendance-stats"
        ? "attendance-stats"
      : searchParams.get("section") === "locker"
          ? "locker"
      : searchParams.get("section") === "marketing"
        ? "marketing"
        : searchParams.get("section") === "sales"
          ? "sales"
        : "member";

  const handleNavigate = (
    nextSection:
      | "member"
      | "membership"
      | "attendance"
      | "attendance-stats"
      | "locker"
      | "marketing"
      | "sales",
  ) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextSection === "membership") {
      params.set("section", "membership");
      params.delete("q");
      params.delete("field");
    } else if (nextSection === "attendance") {
      params.set("section", "attendance");
      params.delete("q");
      params.delete("field");
    } else if (nextSection === "attendance-stats") {
      params.set("section", "attendance-stats");
      params.delete("q");
      params.delete("field");
    } else if (nextSection === "locker") {
      params.set("section", "locker");
      params.delete("q");
      params.delete("field");
    } else if (nextSection === "marketing") {
      params.set("section", "marketing");
      params.delete("q");
      params.delete("field");
    } else if (nextSection === "sales") {
      params.set("section", "sales");
      params.delete("q");
      params.delete("field");
    } else {
      params.delete("section");
    }

    const query = params.toString();
    router.push(query ? `/?${query}` : "/");
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-badge">GYM</span>
        <div>
          <p className="brand-title">PBL Boxing Center</p>
          <p className="brand-subtitle">관리자 모드</p>
        </div>
      </div>
      <nav className="menu">
        <div className="menu-group">
          <button
            className="menu-item menu-toggle"
            type="button"
            onClick={() => setIsMembersOpen((prev) => !prev)}
            aria-expanded={isMembersOpen}
            aria-controls="member-submenu"
          >
            <span>회원 관리</span>
            <span className="menu-toggle-icon">
              {isMembersOpen ? "▾" : "▸"}
            </span>
          </button>
          {isMembersOpen && (
            <div id="member-submenu" className="menu-sub">
              <button
                className={`menu-item sub${
                  section === "member" ? " active" : ""
                }`}
                type="button"
                onClick={() => handleNavigate("member")}
              >
                회원
              </button>
              <button
                className={`menu-item sub${
                  section === "membership" ? " active" : ""
                }`}
                type="button"
                onClick={() => handleNavigate("membership")}
              >
                회원권
              </button>
              <button
                className={`menu-item sub${
                  section === "attendance" ? " active" : ""
                }`}
                type="button"
                onClick={() => handleNavigate("attendance")}
              >
                출석현황
              </button>
              <button
                className={`menu-item sub${
                  section === "attendance-stats" ? " active" : ""
                }`}
                type="button"
                onClick={() => handleNavigate("attendance-stats")}
              >
                출석통계
              </button>
            </div>
          )}
        </div>
        <div className="menu-group">
          <button
            className={`menu-item${section === "locker" ? " active" : ""}`}
            type="button"
            onClick={() => handleNavigate("locker")}
          >
            보관함 관리
          </button>
        </div>
        <div className="menu-group">
          <button
            className={`menu-item${section === "marketing" ? " active" : ""}`}
            type="button"
            onClick={() => handleNavigate("marketing")}
          >
            마케팅
          </button>
        </div>
        <div className="menu-group">
          <button
            className={`menu-item${section === "sales" ? " active" : ""}`}
            type="button"
            onClick={() => handleNavigate("sales")}
          >
            매출관리
          </button>
        </div>
      </nav>
      <div className="sidebar-tools">
        <a className="backup-download" href="/api/backup/sqlite">
          SQLite 백업 다운로드
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;
