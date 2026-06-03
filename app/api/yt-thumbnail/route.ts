import { NextRequest, NextResponse } from "next/server";

// YouTube 썸네일 키 우선순위 (고해상도부터)
const KEYS = ["maxresdefault", "sddefault", "hqdefault", "mqdefault", "default"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return NextResponse.json({ error: "유효하지 않은 비디오 ID" }, { status: 400 });
  }

  // 가장 높은 해상도 이미지 찾기
  for (const key of KEYS) {
    try {
      const url = `https://img.youtube.com/vi/${id}/${key}.jpg`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;

      const buf = await res.arrayBuffer();
      // YouTube는 존재하지 않는 썸네일을 120×90 기본 이미지로 반환 — 크기로 구분
      if (buf.byteLength < 2000) continue;

      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch { continue; }
  }

  return NextResponse.json({ error: "썸네일을 찾을 수 없습니다." }, { status: 404 });
}

export const maxDuration = 15;
