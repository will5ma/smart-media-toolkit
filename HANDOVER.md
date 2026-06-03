# WearableSearch Smart Media Toolkit — 인수인계서

> 작성일: 2026-06-04  
> 작성자: Claude Sonnet 4.6 (AI 페어 프로그래밍 세션)  
> 배포 URL: https://smart-media-toolkit.vercel.app  
> GitHub: https://github.com/will5ma/smart-media-toolkit  

---

## 1. 프로젝트 개요

**WearableSearch**가 운영하는 AI 기반 미디어 유틸리티 워크스페이스.  
브라우저에서 이미지·문서·GIF·영상을 처리하는 5가지 툴로 구성됩니다.

| 툴 | 기능 |
|---|---|
| Image Resizer | 이미지 비율 조정, 크롭, 패딩, ZIP 다운로드 |
| Doc Compressor | PDF 압축 (MuPDF), 페이지/목차 기준 분할 |
| GIF Studio | MP4/WEBM/MOV/AVI/APNG → GIF 변환 |
| YT Thumbnail | YouTube 썸네일 3가지 해상도 추출 |
| Image Converter | JPG/PNG/WEBP/GIF/AVIF → JPG·PNG 변환, 폴더 일괄 변환 |

---

## 2. 기술 스택

```
Framework   : Next.js 16 (App Router, Turbopack)
Language    : TypeScript
Styling     : Tailwind CSS v4 + inline styles (Notion/Linear 테마)
Animation   : Framer Motion
State       : Zustand (appStore — activeTool, uploadedFiles, messages)
Deployment  : Vercel (서버리스 함수 포함)
```

### 핵심 라이브러리

| 라이브러리 | 용도 |
|---|---|
| `pdf-lib` | PDF 생성·분할·페이지 복사 |
| `pdfjs-dist` (6.x) | PDF 렌더링 (canvas), 목차 감지 |
| `mupdf` (WASM) | 서버사이드 PDF 압축 (Vercel API Route) |
| `gif-encoder-2` | 비디오 프레임 → GIF 인코딩 (neuquant) |
| `jszip` | 다중 파일 ZIP 생성 |
| `react-dropzone` | 드래그 앤 드롭 파일 업로드 |
| `lucide-react` | 아이콘 |
| `react-hot-toast` | 알림 토스트 |

---

## 3. 프로젝트 구조

```
smart-media-toolkit/
├── app/
│   ├── api/
│   │   ├── compress-pdf/route.ts   ← mupdf 서버 압축 API
│   │   └── yt-thumbnail/route.ts  ← YouTube 썸네일 프록시 API
│   ├── icon.png                   ← 파비콘 (logo.png 복사본)
│   ├── layout.tsx                 ← metadata, 폰트 설정
│   ├── page.tsx                   ← 메인 레이아웃 (Sidebar + ToolHeader + ToolContent)
│   └── globals.css                ← CSS 변수 (Notion/Linear 디자인 토큰)
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx            ← 왼쪽 네비게이션 (툴 목록 + Instructor Home 링크)
│   │   ├── Header.tsx             ← 상단 헤더 (로고만 표시)
│   │   ├── InputComposer.tsx      ← 파일 업로드 대화창 (현재 미사용)
│   │   └── AuroraBackground.tsx   ← 오로라 배경 (현재 미사용)
│   │
│   └── tools/
│       ├── ImageResizer.tsx
│       ├── DocCompressor.tsx
│       ├── GIFStudio.tsx
│       ├── YoutubeThumbnail.tsx
│       └── ImageConverter.tsx
│
├── store/
│   └── appStore.ts                ← Zustand 전역 상태
├── lib/
│   └── utils.ts                   ← 유틸 함수 (extractYoutubeId, formatBytes 등)
├── public/
│   ├── logo.png
│   ├── pdf.worker.min.mjs         ← pdfjs-dist 워커
│   └── mupdf-wasm.wasm            ← (현재 미사용, node_modules에서 직접 사용)
├── types/
│   └── gif-encoder-2.d.ts         ← gif-encoder-2 타입 선언
└── next.config.ts
```

---

## 4. 환경 설정

### 배포 (Vercel)
- 프로젝트: `will5mas-projects/smart-media-toolkit`
- Vercel 토큰: `env.rtf` 파일에 저장됨 (`.gitignore`에 추가됨 — **커밋 금지**)
- 배포 명령: `npx vercel --prod --token <TOKEN> --scope will5mas-projects --yes`
- GitHub 자동 배포: Vercel ↔ GitHub 연동 완료 (main 브랜치 push 시 자동 배포)

### GitHub
- 계정: `will5ma`
- GitHub token: `env.rtf`에 보관 (`.gitignore` 처리됨)
- **보안 주의**: 두 토큰 모두 채팅창에 노출된 이력 있음 → **즉시 폐기 및 재발급 권장**

### 로컬 개발
```bash
cd /Users/macmini/Antigravity/smart-media-toolkit
npm install
npm run dev       # http://localhost:3000
npm run build     # 프로덕션 빌드 검증
```

---

## 5. 주요 기능 상세

### 5-1. Doc Compressor

**압축 모드**
| 설정 | Scale | JPEG Quality | 적합 대상 |
|---|---|---|---|
| 최대 | 0.60× | 52% | 파일 최소화 |
| 중간 | 0.85× | 72% | 균형 |
| 최적 | 1.80× | 94% | 텍스트 가독성 우선 |

- **4MB 이하 PDF**: Vercel API Route → mupdf WASM (`garbage=4, compress-images, compress-fonts`)
- **4MB 초과 PDF**: 브라우저 canvas → 페이지별 JPEG 재인코딩 (pdfjs-dist 6.x)
- **중요**: pdfjs-dist 6.x는 `default` export 없음 → `{ getDocument, GlobalWorkerOptions }` named import 사용

**분할 모드**
- **페이지별**: 각 페이지 → 개별 PDF
- **범위 지정**: `1-3, 4-6, 7` 형식 입력
- **목차 분할**: `pdfDoc.getOutline()` → 북마크 트리 → 체크박스 선택 → 챕터별 PDF

### 5-2. GIF Studio

- pdfjs-dist와 동일한 동적 import 패턴: `const GIFEncoder = (await import("gif-encoder-2")).default`
- 비디오 seeked 이벤트로 프레임 캡처 → `encoder.addFrame(ctx)` → Blob → ObjectURL
- 최대 30초 제한 (초과 시 경고 표시)

| 품질 | FPS | 너비 | neuquant quality |
|---|---|---|---|
| 최대 | 15 | 480px | 1 (최고) |
| 중간 | 10 | 360px | 5 |
| 최적 | 7 | 240px | 10 (최저) |

### 5-3. YT Thumbnail

- `/api/yt-thumbnail?id={videoId}`: YouTube 서버에서 이미지 fetch → 프록시 반환 (CORS 우회)
- 우선순위: `maxresdefault → sddefault → hqdefault → mqdefault → default`
- 브라우저 canvas로 정확한 해상도(1920×1080, 1280×720, 960×480)로 리사이즈
- 추출 전 해상도 선택 가능 (기본: 전체 선택)

### 5-4. Image Converter

- **파일 모드**: drag & drop → JPG/PNG 변환
- **폴더 모드**: `<input webkitdirectory>` → 폴더 내 전체 이미지 감지 → ZIP 자동 다운로드
- 지원 입력: JPG, PNG, WEBP, GIF, AVIF
- 출력: JPG (품질 슬라이더) 또는 PNG

---

## 6. 디자인 시스템

### CSS 변수 (globals.css)
```css
--bg: #f7f7fc
--surface: #ffffff
--surface-hover: #f1f1ef
--border: rgba(0,0,0,0.07)
--text: #1d1d2e
--text-secondary: rgba(0,0,0,0.5)
--text-tertiary: rgba(0,0,0,0.3)
--accent: #5e6ad2          /* Linear 보라색 */
--accent-light: rgba(94,106,210,0.08)
--radius: 6px
--radius-lg: 10px
```

### 재사용 CSS 클래스
- `.card`: 흰색 카드 (border + shadow)
- `.notion-input`: 입력 필드
- `.btn-primary`: 보라색 채우기 버튼
- `.btn-ghost`: 테두리 버튼
- `.pill` / `.pill.active`: 토글 pill 버튼
- `.drop-zone` / `.drop-zone.active`: 드롭존
- `.section-label`: 대문자 섹션 레이블

---

## 7. 알려진 한계 및 주의사항

### PDF 압축 한계
- **Vercel 무료 플랜**: 요청 본문 최대 4.5MB → 대용량 PDF는 브라우저 canvas 방식으로 폴백
- 텍스트 전용 PDF: JPEG 재인코딩 방식이 비효율적 (Ghostscript 서버사이드가 이상적)
- MuPDF는 Turbopack에서 번들링 불가 → API Route에서만 `require("mupdf")` 사용

### pdfjs-dist 6.x 주의사항
```typescript
// ❌ 틀림
const { default: pdfjsLib } = await import("pdfjs-dist");

// ✅ 맞음
const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; // public 폴더의 워커
```

### 목차 분할 제한
- PDF에 내장 북마크(Outline)가 없으면 감지 불가
- 텍스트로만 인쇄된 목차 페이지는 인식 안 됨

### GIF 변환
- 브라우저 메모리 제한으로 인해 대용량/고해상도 비디오는 실패 가능
- Safari: AVIF 미지원 가능성 있음

---

## 8. 향후 개선 방향

| 우선순위 | 항목 | 설명 |
|---|---|---|
| 높음 | **토큰 폐기** | GitHub PAT, Vercel 토큰 채팅 노출 → 즉시 재발급 |
| 높음 | **대용량 PDF 압축** | Vercel Pro 업그레이드 또는 Railway/Render에 별도 gs 서버 |
| 중간 | **GIF Studio 완성** | 현재 변환만 구현, 편집 기능(crop/speed/reverse) 미구현 |
| 중간 | **텍스트 PDF 목차 감지** | 북마크 없는 PDF에서 정규식으로 목차 페이지 파싱 |
| 낮음 | **다국어 지원** | 현재 한국어 중심, 영어 전환 옵션 |
| 낮음 | **모바일 최적화** | 사이드바 반응형 처리 (현재 데스크탑 위주) |

---

## 9. 빠른 참고

### 새 기능 추가 방법

1. `store/appStore.ts`의 `Tool` 타입에 새 툴 ID 추가
2. `components/layout/Sidebar.tsx`의 `TOOLS` 배열에 항목 추가
3. `app/page.tsx`의 `TOOL_META`에 메타 정보 추가
4. `components/tools/`에 새 컴포넌트 파일 생성
5. `app/page.tsx`의 `ToolContent`에 렌더링 조건 추가

### 배포 절차
```bash
# 1. 로컬 빌드 검증
npm run build

# 2. 커밋
git add -A && git commit -m "..."

# 3. GitHub push (토큰 교체 필요)
git push https://<TOKEN>@github.com/will5ma/smart-media-toolkit.git main

# 4. Vercel 배포 (자동 또는 수동)
npx vercel --prod --token <VERCEL_TOKEN> --scope will5mas-projects --yes
```

---

## 10. 연락처 및 리소스

| 항목 | 내용 |
|---|---|
| 서비스 URL | https://smart-media-toolkit.vercel.app |
| GitHub | https://github.com/will5ma/smart-media-toolkit |
| Vercel 대시보드 | https://vercel.com/will5mas-projects/smart-media-toolkit |
| Instructor Home | https://will5ma.github.io/TutorHome/ |
| 로컬 경로 | `/Users/macmini/Antigravity/smart-media-toolkit` |
