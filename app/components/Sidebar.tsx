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
        : "member";

  const handleNavigate = (
    nextSection: "member" | "membership" | "attendance",
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
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
