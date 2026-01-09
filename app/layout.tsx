import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "My Gym CRM",
  description: "회원 등록 및 관리를 위한 간단한 웹 서비스",
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <div className="brand">
              <span className="brand-icon">MG</span>
              <div>
                <strong>My Gym</strong>
                <span>관리자 패널</span>
              </div>
            </div>
            <nav>
              <Link className="nav-link" href="/">
                홈
              </Link>
              <Link className="nav-link" href="/members">
                회원 관리
              </Link>
            </nav>
            <div className="sidebar-card">
              <p>오늘의 목표</p>
              <strong>+12 신규 회원</strong>
              <button className="button-secondary" type="button">
                목표 수정
              </button>
            </div>
          </aside>
          <div className="content">
            <header className="topbar">
              <div>
                <h2>운영 센터</h2>
                <p>오늘도 활기차게 운영해 보세요.</p>
              </div>
              <div className="topbar-actions">
                <button className="button-secondary" type="button">
                  메시지 발송
                </button>
                <button className="button-primary" type="button">
                  운영 리포트
                </button>
              </div>
            </header>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
};

export default RootLayout;
