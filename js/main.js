/* =============================================
   스템케어재팬 - 메인 JavaScript
   ============================================= */

/* ===== i18n 번역 데이터 ===== */
const i18nData = {
  ko: {
    'nav.about': '소개',
    'nav.services': '서비스',
    'nav.process': '이용방법',
    'nav.treatment': '치료안내',
    'nav.tourism': '관광안내',
    'nav.contact': '무료 상담',
    'hero.badge': '일본 공인 줄기세포 치료 전문 파트너',
    'hero.title': '당신의 건강 여정,<br /><span class="hero-highlight">처음부터 끝까지</span><br />함께합니다',
    'hero.sub': '자택 픽업부터 일본 귀환까지 — 줄기세포 치료, 통역, 호텔, 관광까지<br />스템케어재팬이 모든 것을 책임지는 <strong>토탈케어 서비스</strong>',
    'hero.cta1': '무료 상담 신청',
    'hero.cta2': '이용방법 보기',
    'city.sightseeing': '관광 명소',
    'city.food': '식도락',
    'city.shopping': '쇼핑',
    'city.daycourse': '추천 1일 코스',
    'city.tokyo.name': '도쿄',
    'city.tokyo.flight': '약 2.5시간',
    'city.tokyo.season': '추천: 봄·가을',
    'city.tokyo.desc': '세계적인 대도시 도쿄에서 전통과 현대가 공존하는 특별한 경험을 즐기세요. 하네다·나리타 공항 직항 편리.',
    'city.osaka.name': '오사카',
    'city.osaka.flight': '약 1.5시간',
    'city.osaka.season': '추천: 봄·가을',
    'city.osaka.desc': '음식의 천국 오사카에서 맛과 문화를 동시에 경험하세요. 간사이 국제공항 직항으로 편리하게 접근 가능합니다.',
    'city.fukuoka.name': '후쿠오카',
    'city.fukuoka.flight': '항공 약 1시간',
    'city.fukuoka.ship': '선박 3~6시간',
    'city.fukuoka.best': '최단 접근',
    'city.fukuoka.desc': '한국에서 가장 가까운 일본 대도시. 부산에서 쾌속선으로 3시간, 항공으로 1시간 이내. 의료관광 최적의 도시입니다.',
    'city.kyoto.name': '교토',
    'city.kyoto.flight': '오사카 경유 약 2시간',
    'city.kyoto.season': '추천: 봄·단풍 시즌',
    'city.kyoto.desc': '일본의 천년 고도 교토에서 전통의 아름다움을 만끽하세요. 힐링과 문화, 치유의 도시입니다.',
  },
  ja: {
    'nav.about': '私たちについて',
    'nav.services': 'サービス',
    'nav.process': 'ご利用方法',
    'nav.treatment': '治療案内',
    'nav.tourism': '観光案内',
    'nav.contact': '無料相談',
    'hero.badge': '日本公認幹細胞治療の専門パートナー',
    'hero.title': 'あなたの健康の旅を、<br /><span class="hero-highlight">最初から最後まで</span><br />ご一緒します',
    'hero.sub': '自宅送迎から日本帰国まで — 幹細胞治療、通訳、ホテル、観光まで<br />スロングケアジャパンが責任を持つ<strong>トータルケアサービス</strong>',
    'hero.cta1': '無料相談を申し込む',
    'hero.cta2': 'ご利用方法を見る',
    'city.sightseeing': '観光スポット',
    'city.food': 'グルメ',
    'city.shopping': 'ショッピング',
    'city.daycourse': 'おすすめ1日コース',
    'city.tokyo.name': '東京',
    'city.tokyo.flight': '約2.5時間',
    'city.tokyo.season': '推奨：春・秋',
    'city.tokyo.desc': '世界的な大都市・東京で伝統と現代が共存する特別な体験をお楽しみください。羽田・成田空港への直行便が便利です。',
    'city.osaka.name': '大阪',
    'city.osaka.flight': '約1.5時間',
    'city.osaka.season': '推奨：春・秋',
    'city.osaka.desc': '食の都・大阪で味と文化を同時にお楽しみください。関西国際空港への直行便で便利にアクセスできます。',
    'city.fukuoka.name': '福岡',
    'city.fukuoka.flight': '飛行機 約1時間',
    'city.fukuoka.ship': '船 3～6時間',
    'city.fukuoka.best': '最短アクセス',
    'city.fukuoka.desc': '韓国から最も近い日本の大都市。釜山から高速船で3時間、飛行機で1時間以内。医療観光に最適な都市です。',
    'city.kyoto.name': '京都',
    'city.kyoto.flight': '大阪経由 約2時間',
    'city.kyoto.season': '推奨：春・紅葉シーズン',
    'city.kyoto.desc': '日本の千年の古都・京都で伝統の美しさをお楽しみください。癒しと文化と治癒の都市です。',
  },
  en: {
    'nav.about': 'About',
    'nav.services': 'Services',
    'nav.process': 'How It Works',
    'nav.treatment': 'Treatment',
    'nav.tourism': 'Tourism',
    'nav.contact': 'Free Consult',
    'hero.badge': 'Japan-Certified Stem Cell Treatment Partner',
    'hero.title': 'Your Health Journey,<br /><span class="hero-highlight">From Start to Finish</span><br />We\'re With You',
    'hero.sub': 'From home pickup to Japan return — stem cell treatment, interpretation, hotel, and tourism.<br />StemCare Japan\'s <strong>Total Care Service</strong> handles everything.',
    'hero.cta1': 'Free Consultation',
    'hero.cta2': 'See How It Works',
    'city.sightseeing': 'Sightseeing',
    'city.food': 'Dining',
    'city.shopping': 'Shopping',
    'city.daycourse': 'Recommended Day Tour',
    'city.tokyo.name': 'Tokyo',
    'city.tokyo.flight': 'Approx. 2.5 hrs',
    'city.tokyo.season': 'Best: Spring & Autumn',
    'city.tokyo.desc': 'Experience the unique blend of tradition and modernity in Tokyo. Easy access via Haneda and Narita airports.',
    'city.osaka.name': 'Osaka',
    'city.osaka.flight': 'Approx. 1.5 hrs',
    'city.osaka.season': 'Best: Spring & Autumn',
    'city.osaka.desc': 'Discover the food capital of Japan. Direct flights to Kansai International Airport make access convenient.',
    'city.fukuoka.name': 'Fukuoka',
    'city.fukuoka.flight': 'By air ~1 hr',
    'city.fukuoka.ship': 'By ferry 3–6 hrs',
    'city.fukuoka.best': 'Closest City',
    'city.fukuoka.desc': 'The closest major Japanese city to Korea. Under 1 hour by air, 3 hours by high-speed ferry from Busan. Ideal for medical tourism.',
    'city.kyoto.name': 'Kyoto',
    'city.kyoto.flight': 'Via Osaka, ~2 hrs',
    'city.kyoto.season': 'Best: Cherry Blossom & Fall Foliage',
    'city.kyoto.desc': 'Immerse yourself in Japan\'s ancient capital. A city of healing, culture, and timeless beauty.',
  }
};

/* ===== 언어 전환 함수 ===== */
function setLanguage(lang) {
  if (!i18nData[lang]) return;
  const t = i18nData[lang];

  // data-i18n: 텍스트 교체
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key] !== undefined) el.textContent = t[key];
  });

  // data-i18n-html: HTML 교체 (hero title 등)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    if (t[key] !== undefined) el.innerHTML = t[key];
  });

  // html lang 속성 업데이트
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;

  // 버튼 active 상태 업데이트
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // localStorage 저장
  localStorage.setItem('scj-lang', lang);
}

document.addEventListener('DOMContentLoaded', function () {

  // ===== 언어 전환 버튼 =====
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  // 저장된 언어 복원 (기본: ko)
  const savedLang = localStorage.getItem('scj-lang') || 'ko';
  if (savedLang !== 'ko') setLanguage(savedLang);

  // ===== AOS 초기화 =====
  AOS.init({
    duration: 700,
    once: true,
    offset: 60,
    easing: 'ease-out-cubic'
  });

  // ===== 네비게이션 스크롤 효과 =====
  const header = document.getElementById('site-header');
  const handleScroll = () => {
    if (window.scrollY > 60) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // ===== 모바일 햄버거 메뉴 =====
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('main-nav');
  const navOverlay = createNavOverlay();

  function createNavOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 998; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function toggleMenu(force) {
    const isOpen = force !== undefined ? force : !hamburger.classList.contains('open');
    hamburger.classList.toggle('open', isOpen);
    mainNav.classList.toggle('open', isOpen);
    navOverlay.style.opacity = isOpen ? '1' : '0';
    navOverlay.style.pointerEvents = isOpen ? 'all' : 'none';
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  hamburger.addEventListener('click', () => toggleMenu());
  navOverlay.addEventListener('click', () => toggleMenu(false));

  // 내비 링크 클릭 시 메뉴 닫기
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => toggleMenu(false));
  });

  // ===== 부드러운 스크롤 =====
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const headerH = header.offsetHeight;
        const top = target.getBoundingClientRect().top + window.pageYOffset - headerH;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ===== 파티클 생성 =====
  const particleContainer = document.getElementById('hero-particles');
  if (particleContainer) {
    const COUNT = 30;
    for (let i = 0; i < COUNT; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 6 + 2;
      const left = Math.random() * 100;
      const delay = Math.random() * 15;
      const duration = Math.random() * 15 + 10;
      p.style.cssText = `
        width: ${size}px; height: ${size}px;
        left: ${left}%; bottom: -10px;
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
        opacity: ${Math.random() * 0.5 + 0.1};
      `;
      particleContainer.appendChild(p);
    }
  }

  // ===== 도시 탭 =====
  const cityTabs = document.querySelectorAll('.city-tab');
  const cityPanels = document.querySelectorAll('.city-panel');

  cityTabs.forEach(tab => {
    tab.addEventListener('click', function () {
      const city = this.dataset.city;

      cityTabs.forEach(t => t.classList.remove('active'));
      cityPanels.forEach(p => p.classList.remove('active'));

      this.classList.add('active');
      const panel = document.getElementById('city-' + city);
      if (panel) {
        panel.classList.add('active');
        // AOS 재트리거
        panel.querySelectorAll('[data-aos]').forEach(el => {
          el.classList.add('aos-animate');
        });
      }
    });
  });

  // ===== 후기 슬라이더 =====
  const track = document.getElementById('testimonial-track');
  const dotsContainer = document.getElementById('slider-dots');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  if (track) {
    const cards = track.querySelectorAll('.testimonial-card');
    let currentIndex = 0;
    let cardWidth = 0;
    let visibleCount = getVisibleCount();
    let maxIndex = cards.length - visibleCount;
    let autoTimer;

    function getVisibleCount() {
      if (window.innerWidth < 900) return 1;
      if (window.innerWidth < 1024) return 2;
      return 3;
    }

    // 도트 생성
    function buildDots() {
      dotsContainer.innerHTML = '';
      visibleCount = getVisibleCount();
      maxIndex = cards.length - visibleCount;
      if (maxIndex < 0) maxIndex = 0;

      for (let i = 0; i <= maxIndex; i++) {
        const dot = document.createElement('button');
        dot.className = 'dot' + (i === currentIndex ? ' active' : '');
        dot.setAttribute('aria-label', `슬라이드 ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        dotsContainer.appendChild(dot);
      }
    }

    function updateDots() {
      dotsContainer.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('active', i === currentIndex);
      });
    }

    function goTo(index) {
      currentIndex = Math.max(0, Math.min(index, maxIndex));
      const gap = window.innerWidth < 900 ? 0 : 24;
      cardWidth = cards[0].offsetWidth + gap;
      track.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
      updateDots();
    }

    function next() { goTo(currentIndex >= maxIndex ? 0 : currentIndex + 1); }
    function prev() { goTo(currentIndex <= 0 ? maxIndex : currentIndex - 1); }

    prevBtn.addEventListener('click', () => { clearInterval(autoTimer); prev(); startAuto(); });
    nextBtn.addEventListener('click', () => { clearInterval(autoTimer); next(); startAuto(); });

    function startAuto() {
      autoTimer = setInterval(next, 5000);
    }

    // 터치 스와이프
    let touchStartX = 0;
    track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        diff > 0 ? next() : prev();
      }
    }, { passive: true });

    buildDots();
    startAuto();

    window.addEventListener('resize', () => {
      clearInterval(autoTimer);
      buildDots();
      goTo(0);
      startAuto();
    });
  }

  // ===== FAQ 아코디언 =====
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question');
    btn.addEventListener('click', function () {
      const isOpen = item.classList.contains('open');

      // 같은 그룹 내 모두 닫기
      const parent = item.closest('.faq-list');
      if (parent) {
        parent.querySelectorAll('.faq-item.open').forEach(openItem => {
          openItem.classList.remove('open');
        });
      }

      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });

  // ===== 상담 폼 제출 =====
  const contactForm = document.getElementById('contact-form');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose = document.getElementById('modal-close');

  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const btn = contactForm.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 처리 중...';

      // 폼 데이터 수집 후 API 저장
      const formData = {
        name: contactForm.name.value,
        age: contactForm.age.value,
        phone: contactForm.phone.value,
        email: contactForm.email.value,
        disease: contactForm.disease.value,
        package: contactForm.package.value,
        message: contactForm.message.value,
        submitted_at: new Date().toISOString()
      };

      // API 저장 시도
      fetch('tables/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
        .then(res => res.ok ? res.json() : null)
        .catch(() => null)
        .finally(() => {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-paper-plane"></i> 무료 상담 신청하기';
          contactForm.reset();
          modalOverlay.classList.add('active');
        });
    });
  }

  if (modalClose) {
    modalClose.addEventListener('click', () => {
      modalOverlay.classList.remove('active');
    });
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('active');
    });
  }

  // ===== 맨 위로 버튼 =====
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.style.opacity = window.scrollY > 400 ? '1' : '0';
      backToTop.style.pointerEvents = window.scrollY > 400 ? 'all' : 'none';
    }, { passive: true });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ===== 카운터 애니메이션 =====
  function animateCounter(el, target, duration, suffix) {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      el.textContent = Math.floor(start) + suffix;
      if (start >= target) clearInterval(timer);
    }, 16);
  }

  const statNums = document.querySelectorAll('.stat-num');
  let statsAnimated = false;

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !statsAnimated) {
        statsAnimated = true;
        const counters = [
          { el: statNums[0], target: 500, suffix: '+' },
          { el: statNums[1], target: 98, suffix: '%' },
          { el: statNums[2], target: 5, suffix: '+' },
          { el: statNums[3], target: 24, suffix: 'h' }
        ];
        counters.forEach(({ el, target, suffix }) => {
          if (el) animateCounter(el, target, 1500, suffix);
        });
        statsObserver.disconnect();
      }
    });
  }, { threshold: 0.5 });

  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) statsObserver.observe(heroStats);

  // ===== 소스코드 다운로드 =====
  const downloadBtn = document.getElementById('download-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async function (e) {
      e.preventDefault();
      downloadBtn.textContent = '📦 패키징 중...';
      downloadBtn.style.pointerEvents = 'none';

      try {
        const zip = new JSZip();

        // 파일 목록
        const files = [
          { path: 'index.html', name: 'index.html' },
          { path: 'css/style.css', name: 'css/style.css' },
          { path: 'js/main.js', name: 'js/main.js' },
          { path: 'README.md', name: 'README.md' }
        ];

        // 각 파일 fetch 후 zip 추가
        const fetches = files.map(async ({ path, name }) => {
          try {
            const resp = await fetch(path);
            if (resp.ok) {
              const text = await resp.text();
              zip.file(name, text);
            }
          } catch (err) {
            console.warn(`파일 로드 실패: ${path}`, err);
          }
        });

        await Promise.all(fetches);

        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, 'stemcarejapan-website.zip');

        downloadBtn.textContent = '✅ 다운로드 완료!';
        setTimeout(() => {
          downloadBtn.textContent = '소스코드 다운로드';
          downloadBtn.style.pointerEvents = '';
        }, 3000);
      } catch (err) {
        console.error('다운로드 오류:', err);
        downloadBtn.textContent = '다운로드 재시도';
        downloadBtn.style.pointerEvents = '';
      }
    });
  }

  // ===== 네비 활성 섹션 표시 =====
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link:not(.nav-cta)');

  function updateActiveNav() {
    let current = '';
    sections.forEach(section => {
      const top = section.offsetTop - header.offsetHeight - 60;
      if (window.scrollY >= top) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active-nav');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active-nav');
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });

  // nav active 스타일
  const style = document.createElement('style');
  style.textContent = `.nav-link.active-nav { color: var(--white) !important; background: rgba(255,255,255,0.12) !important; }`;
  document.head.appendChild(style);

  // ===== 이미지 레이지 로드 (placeholder에 shimmer 효과) =====
  const placeholders = document.querySelectorAll('.about-img-placeholder, .city-img-placeholder');
  placeholders.forEach(el => {
    el.style.position = 'relative';
    el.style.overflow = 'hidden';

    const shimmer = document.createElement('div');
    shimmer.style.cssText = `
      position: absolute; inset: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
      background-size: 200% 100%;
      animation: shimmer 2.5s infinite;
    `;
    el.appendChild(shimmer);
  });

  const shimmerStyle = document.createElement('style');
  shimmerStyle.textContent = `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(shimmerStyle);

  // ===== 초기 로딩 완료 후 body 페이드인 =====
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.5s ease';
  window.addEventListener('load', () => {
    document.body.style.opacity = '1';
  });

  // 빠른 로드를 위한 폴백
  setTimeout(() => {
    document.body.style.opacity = '1';
  }, 300);

});
