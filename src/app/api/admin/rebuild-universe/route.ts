import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * POST /api/admin/rebuild-universe
 *
 * 우주 레이아웃 전체 재계산 파이프라인 트리거.
 * ⚠️ 로컬(localhost) 전용 — Vercel 프러덕션에서는 파일시스템 쓰기 불가 & 60초 타임아웃.
 *
 * 파이프라인:
 *   1. build-graph.ts  — hub JSON → 크레딧 기반 edge weight 포함 graph.json 생성
 *   2. compute-layout.ts — Torus Force-Directed 시뮬레이션 → 좌표 계산
 */
export async function POST() {
  // 프러덕션 차단
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_ADMIN_REBUILD) {
    return NextResponse.json(
      { success: false, error: "🚨 프러덕션에서는 실행 불가. 로컬(localhost:3000)에서만 사용하세요." },
      { status: 403 }
    );
  }

  try {
    console.log("[Admin] universe:rebuild 시작...");

    // Step 1: build-graph (hub JSON → graph.json, 크레딧 가중치 반영)
    console.log("[Admin] Step 1: build-graph.ts 실행...");
    const graphResult = await execAsync(
      "npx tsx scripts/build-graph.ts",
      { cwd: process.cwd(), timeout: 30000 }
    );

    // Step 2: compute-layout (Force-Directed 시뮬레이션)
    console.log("[Admin] Step 2: compute-layout.ts 실행...");
    const layoutResult = await execAsync(
      "npx tsx scripts/compute-layout.ts",
      { cwd: process.cwd(), timeout: 120000 } // 최대 2분
    );

    const combinedLog = [
      "=== build-graph ===",
      graphResult.stdout,
      graphResult.stderr,
      "=== compute-layout ===",
      layoutResult.stdout,
      layoutResult.stderr,
    ].filter(Boolean).join("\n");

    return NextResponse.json({ success: true, log: combinedLog });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        log: [err.stdout, err.stderr].filter(Boolean).join("\n"),
      },
      { status: 500 }
    );
  }
}
