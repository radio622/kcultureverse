import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, spotifyId, nameKo } = body;

    if (!name || !spotifyId) {
      return NextResponse.json(
        { success: false, error: "아티스트 이름과 Spotify ID는 필수입니다." },
        { status: 400 }
      );
    }

    // 보안상 특수문자 이스케이프 (단순 구현)
    const safeName = name.replace(/"/g, '\\"');
    const safeId = spotifyId.replace(/"/g, '\\"');
    const safeNameKo = (nameKo || name).replace(/"/g, '\\"');

    // 현재 프로젝트 루트의 scripts/add-artist.ts 실행
    const scriptPath = path.resolve(process.cwd(), "scripts/add-artist.ts");
    const cmd = `npx tsx "${scriptPath}" "${safeName}" "${safeId}" "${safeNameKo}"`;

    const { stdout, stderr } = await execAsync(cmd, { cwd: process.cwd() });

    return NextResponse.json({
      success: true,
      log: stdout,
      errorLog: stderr,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to add artist", log: err.stdout, errorLog: err.stderr },
      { status: 500 }
    );
  }
}
