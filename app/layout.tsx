import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProcessCheck - 개발 프로세스 관리 시스템",
  description: "전자제품 개발 프로세스의 투명성 확보 및 부서 간 협업 효율화 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
