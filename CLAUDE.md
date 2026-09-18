# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**StemCareJapan** (스템케어재팬) is a single-page static website for a Korean-to-Japan stem cell medical tourism service. It is written in vanilla HTML/CSS/JS with no build tooling, bundler, or package manager.

## Running the Site

### Docker (권장)

`Dockerfile`과 `docker-compose.yml`이 구성되어 있으며, nginx:alpine 기반으로 포트 8080에서 서비스됩니다. 로컬 파일이 볼륨으로 마운트되어 있어 파일 수정 후 브라우저 새로고침만 하면 바로 반영됩니다.

```bash
# 시작 (백그라운드)
docker compose up -d

# 이미지 재빌드 후 시작
docker compose up -d --build

# 중지
docker compose down

# 로그 확인
docker compose logs -f
```

접속: http://localhost:8080

### 대안 (Docker 없이)

```bash
# Python
python3 -m http.server 8080

# Node (if available)
npx serve .
```

The static site uses no npm build; the consulting chat workspaces use `npm run build` and `npm test`. See `README-chat.md`.

## Architecture

All content lives in three core files plus an `images/` folder:

- **`index.html`** — Single HTML file containing every section in order: Hero → About → Services → How It Works (Process) → Treatment → Tourism → Testimonials → FAQ → Contact → Footer. Sections are identified by `id` attributes (e.g. `#hero`, `#services`, `#treatment`).
- **`css/style.css`** — Single stylesheet covering all layout, theming, and responsive breakpoints (>1100px, 900–1100px, 640–900px, <640px). Design direction: "Refined Luxury Medical" — midnight navy `#0b1d3a`, champagne gold `#b8922d`, warm ivory `#f5f0e6`.
- **`js/main.js`** — Single JS file handling all interactivity: i18n language switching, AOS animation init, sticky nav scroll effect, mobile hamburger menu, smooth scroll, hero particles, counter animation, city tab switching, testimonial slider (auto-play + touch swipe), FAQ accordion, active nav highlighting, contact form modal, floating buttons, and ZIP source download.
- **`js/chat/`** — 상담 채팅 위젯(Phase 2). ES module 9개로 나뉘어 있고 빌드 도구를 쓰지 않는다.
  `config`(상수) · `i18n`(한/일 문구) · `state`(세션·메시지 + subscribe/notify) ·
  `api`(fetch 래퍼) · `poller`(3초 폴링, socket 연결 실패 시 폴백) ·
  `socket`(Socket.IO 클라이언트) · `stream`(socket 우선, 실패 시 poller 로 자동 전환) ·
  `render`(DOM·스크롤) · `widget`(진입점). 레이어 규칙: `api.js`는 DOM을 모르고,
  `render.js`는 fetch를 모른다.
- **`css/chat-widget.css`** — 위젯 채팅 화면 스타일. `style.css` **뒤에** 읽혀야 한다.
  `style.css`를 쓰지 않는 `korea-travel/`을 위해 `.chat-standalone` 기본 스타일을 함께 담고 있다.
- **`images/`** — Static image assets organized by section (see Image Structure below).

## i18n (다국어 지원)

The site supports Korean (KO), Japanese (JA), and English (EN).

**How it works:**
- Translation strings live in the `i18nData` object at the top of `js/main.js`.
- HTML elements are tagged with `data-i18n="key"` (text replacement) or `data-i18n-html="key"` (innerHTML replacement, for elements containing HTML tags like `<br>` or `<span>`).
- `setLanguage(lang)` iterates all tagged elements and replaces their content.
- The `<html>` element carries `data-lang="ko|ja|en"` — use this for CSS language-specific overrides if needed.
- Selected language is persisted in `localStorage` under key `scj-lang`.

**Adding a new translation key:**
1. Add the key+value to all three language objects in `i18nData` (`ko`, `ja`, `en`).
2. Add `data-i18n="your.key"` to the target HTML element.

**Current translation coverage:** Navigation links, hero section (badge, title, sub-text, CTAs), city tab content (name, badges, descriptions, category headings, day course labels).

## Image Structure

```
images/
├── hero/           ← hero-bg.jpg (1920×1080 recommended)
├── about/          ← hospital.jpg
├── treatment/      ← stemcell.jpg
├── tourism/
│   ├── tokyo/      ← tokyo-main.jpg (800×500)
│   ├── osaka/      ← osaka-main.jpg
│   ├── fukuoka/    ← fukuoka-main.jpg
│   └── kyoto/      ← kyoto-main.jpg
├── testimonials/
├── partners/
└── README.md       ← image sourcing and placement guide
```

The `docker-compose.yml` mounts `./images` as a volume, so images placed here are immediately served without a rebuild.

To replace a city placeholder with a real image, swap the `<div class="city-img-placeholder ...">` block with:
```html
<img src="images/tourism/tokyo/tokyo-main.jpg" alt="도쿄 관광" class="city-img" loading="lazy" />
```

## Tourism Section Structure

Each city panel (`#city-tokyo`, `#city-osaka`, `#city-fukuoka`, `#city-kyoto`) contains:
- **city-meta**: city name + `city-badges` (flight time, season, etc.)
- **city-desc**: short description paragraph (tagged `data-i18n`)
- **city-spots**: three `spot-category` divs (sightseeing, food, shopping)
- **day-course**: recommended 1-day itinerary with `dc-step` items (time + spot)

## External Dependencies (CDN only)

All dependencies are loaded via CDN — no local `node_modules`:

| Library | Version | Purpose |
|---------|---------|---------|
| Google Fonts | — | Cormorant Garamond (display/numerals), Noto Serif KR (headings), Noto Sans KR (body) |
| Font Awesome | 6.5.0 | Icons |
| AOS | 2.3.4 | Scroll animations |
| JSZip | 3.10.1 | ZIP generation for source download |
| FileSaver.js | 2.0.5 | Browser file download |

## Design Tokens

- Primary: `#0b1d3a` (midnight navy)
- Accent: `#b8922d` (champagne gold)
- Background light: `#f5f0e6` (warm ivory)
- Display font: `Cormorant Garamond` (used for stat numbers, step numbers, decorative quotes, package days)
- Heading font: `Noto Serif KR`
- Body font: `Noto Sans KR`

## Contact Form / Data Model

The contact form (`#contact`) collects: name, age, phone, email, disease, package, message. Form submission currently shows a success modal only — no backend is wired up. The `fetch('tables/inquiries', ...)` call in `main.js` is a stub for future API integration.

## 상담채팅시스템 (Phase 0~6)

정적 홈페이지와 별개로 `apps/api`(Express + Socket.IO), `apps/admin`(Next.js),
`packages/shared`(공용 타입)가 npm workspace 로 함께 관리된다.

- 실행 방법과 포트 배치: `README-chat.md` 참고
- 단계별 개발계획서: `docs/plans/working/20260904_phase[0-6]_상담채팅시스템개발계획서.md`
- 상태값/언어코드 등 상수는 반드시 `@stemcare/shared` 에서 import 한다.
- 운영자 화면 테스트: `npm run test -w apps/admin` (Vitest + Testing Library).
  vitest 는 `apps/api` 와 **같은 메이저**로 유지한다. 버전이 갈리면 jest-dom 이
  실행 중이 아닌 쪽 `expect` 를 확장해 모든 matcher 가 죽는다.
- 관리자 화면의 모든 API 호출은 `credentials: 'include'` 가 필요하다. (`apps/admin/lib/api.ts`)
- 고객·관리자 E2E: `npm run test:e2e` (`tests/e2e/`, Playwright). PostgreSQL만 사전 실행하며 TEST_DATABASE_URL과 전용 18081/14001/13101 서버를 사용한다.
- 위젯 회귀 테스트: `npm run test:widget`. 관리자 단위·상호작용 테스트: `npm run test:admin`.
- 위젯 문구는 전부 `data-i18n` 속성으로 표시한다. 페이지가 `<html lang>` 을 바꾸면
  위젯이 MutationObserver 로 감지해 같은 언어로 다시 칠한다.


## Phase 4~6 검토 인계

AI 결과 저장·인계·보관 정리는 방 잠금 규칙을 보존한다. 모델 호출 중에는 잠금을 잡지 않고, 저장 직전에 상담 상태와 마지막 메시지를 재확인한다. 비동기 작업은 `trackBackground`에 등록해 테스트 DB 초기화와 서버 종료 전에 배수한다. 자동 테스트는 OPENAI_API_KEY를 비운다. `docs/plans/working`의 Phase4~6 문서가 실제 완료 범위이며 라이브 AI 품질·운영 배포까지 완료한 것으로 해석하지 않는다.
