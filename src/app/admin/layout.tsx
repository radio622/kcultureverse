/**
 * /admin — Admin 대시보드 서버 레이아웃
 * proxy.ts에서 1차 role 체크가 이루어지고
 * 여기서 layout과 공통 UI를 감쌈
 */
import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminShell from "./AdminShell";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") redirect("/");

  return <AdminShell>{children}</AdminShell>;
}
