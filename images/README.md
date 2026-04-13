# 이미지 폴더 구조

Unsplash(https://unsplash.com) 또는 Pexels(https://pexels.com)에서 무료 이미지를 다운로드하여 아래 경로에 배치하세요.
라이선스: 상업적 사용 가능, 저작권 표시 불필요.

```
images/
├── hero/
│   └── hero-bg.jpg          # 히어로 배경 (일본 병원 / 도시 야경) 추천: 1920×1080
│
├── about/
│   └── hospital.jpg         # 일본 병원 내부 / 의사 상담 장면 추천: 800×600
│
├── treatment/
│   └── stemcell.jpg         # 줄기세포 / 의료 연구 이미지 추천: 800×600
│
├── tourism/
│   ├── tokyo/
│   │   └── tokyo-main.jpg   # 도쿄 스카이라인 / 센소지 추천: 800×500
│   ├── osaka/
│   │   └── osaka-main.jpg   # 도톤보리 / 오사카성 추천: 800×500
│   ├── fukuoka/
│   │   └── fukuoka-main.jpg # 하카타 / 다자이후 추천: 800×500
│   └── kyoto/
│       └── kyoto-main.jpg   # 후시미이나리 / 아라시야마 추천: 800×500
│
├── testimonials/
│   └── (환자 사진 — 동의 받은 실제 사진만 사용)
│
└── partners/
    └── (제휴 병원 로고 — 병원으로부터 직접 제공받아 사용)
```

## 추천 검색어 (Unsplash)

| 용도 | 검색어 |
|------|--------|
| 히어로 배경 | `japan city night`, `tokyo skyline` |
| 병원/의료 | `hospital modern japan`, `doctor consultation` |
| 줄기세포 | `stem cell`, `medical research laboratory` |
| 도쿄 | `tokyo`, `senso-ji temple`, `shibuya` |
| 오사카 | `osaka castle`, `dotonbori` |
| 후쿠오카 | `fukuoka`, `dazaifu` |
| 교토 | `kyoto`, `fushimi inari`, `arashiyama` |

## 이미지 적용 방법

`index.html`의 placeholder div를 `<img>` 태그로 교체:

```html
<!-- 변경 전 -->
<div class="city-img-placeholder">
  <i class="fas fa-torii-gate"></i>
  <p>도쿄</p>
</div>

<!-- 변경 후 -->
<img src="images/tourism/tokyo/tokyo-main.jpg" alt="도쿄 관광" class="city-img" loading="lazy" />
```
