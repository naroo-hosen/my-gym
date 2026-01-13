import "./globals.css";
import type { ReactNode } from "react";
import { ensureMembershipExpiryBatch } from "@/lib/membershipExpiryBatch";

export const metadata = {
  title: "My Gym CRM",
  description: "회원 등록 및 관리를 위한 간단한 웹 서비스",
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  ensureMembershipExpiryBatch();

  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
