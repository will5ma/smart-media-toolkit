import { NextRequest, NextResponse } from "next/server";

type CompressionLevel = "최대" | "중간" | "최적";

const OPTIONS: Record<CompressionLevel, string> = {
  "최대": "garbage=4,compress,compress-images,compress-fonts",
  "중간": "garbage=3,compress,compress-images,compress-fonts",
  "최적": "garbage=2,compress,compress-fonts",
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const level = (formData.get("level") as CompressionLevel) ?? "중간";

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    // 파일 크기 제한: 200MB
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: "파일이 200MB를 초과합니다." }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();

    // mupdf — 서버(Node.js) 환경에서만 실행
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mupdf = require("mupdf").default ?? require("mupdf");

    const doc = mupdf.Document.openDocument(
      new Uint8Array(arrayBuffer),
      "application/pdf"
    );
    const pdf = doc.asPDF();
    if (!pdf) {
      return NextResponse.json({ error: "PDF 파싱에 실패했습니다." }, { status: 422 });
    }

    const saveOptions = OPTIONS[level] ?? OPTIONS["중간"];
    const buf = pdf.saveToBuffer(saveOptions);
    const compressed = buf.asUint8Array();

    return new NextResponse(compressed, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="compressed-${file.name}"`,
        "X-Original-Size": String(file.size),
        "X-Compressed-Size": String(compressed.byteLength),
      },
    });
  } catch (err) {
    console.error("[compress-pdf] error:", err);
    return NextResponse.json(
      { error: "압축 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// Vercel 서버리스 함수 최대 실행 시간 60초
export const maxDuration = 60;
