/**
 * /mypage — 서버 컴포넌트 래퍼
 * Auth.js 서버 세션 확인 후 MypageClient로 렌더링 위임
 */
import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import MypageClient from "./MypageClient";

export const metadata: Metadata = {
  title: "마이페이지",
  description: "K-Culture Universe 계정 설정",
};

export default async function MypagePage() {
  const session = await auth();
  if (!session) redirect("/");

  return <MypageClient />;
}
