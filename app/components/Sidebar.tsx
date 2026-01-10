"use client";

import { useState } from "react";

const Sidebar = () => {
  const [isMembersOpen, setIsMembersOpen] = useState(true);

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
              <button className="menu-item sub active" type="button">
                회원
              </button>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
