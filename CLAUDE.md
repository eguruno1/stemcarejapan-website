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

There are no build, lint, or test commands — this is a zero-dependency static site.

## Architecture

All content lives in three core files plus an `images/` folder:

- **`index.html`** — Single HTML file containing every section in order: Hero → About → Services → How It Works (Process) → Treatment → Tourism → Testimonials → FAQ → Contact → Footer. Sections are identified by `id` attributes (e.g. `#hero`, `#services`, `#treatment`).
- **`css/style.css`** — Single stylesheet covering all layout, theming, and responsive breakpoints (>1100px, 900–1100px, 640–900px, <640px). Design direction: "Refined Luxury Medical" — midnight navy `#0b1d3a`, champagne gold `#b8922d`, warm ivory `#f5f0e6`.
- **`js/main.js`** — Single JS file handling all interactivity: i18n language switching, AOS animation init, sticky nav scroll effect, mobile hamburger menu, smooth scroll, hero particles, counter animation, city tab switching, testimonial slider (auto-play + touch swipe), FAQ accordion, active nav highlighting, contact form modal, floating buttons, and ZIP source download.
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
