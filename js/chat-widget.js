/* =============================================
   StemCareJapan - Free Consultation Chat Widget
   ============================================= */

(function () {
  const pagePath = window.location.pathname;
  const isTravelPage = pagePath.includes('/korea-travel');
  const isStemcellPage = pagePath.includes('/stemcell');

  function getLang() {
    const lang = document.documentElement.lang || document.documentElement.dataset.lang || 'ko';
    return lang.startsWith('ja') ? 'ja' : 'ko';
  }

  const copy = {
    ko: {
      openLabel: '무료 상담 채팅 열기',
      closeLabel: '무료 상담 채팅 닫기',
      badge: '무료 상담',
      title: '상담을 도와드릴게요',
      intro: '아래 내용을 남겨주시면 상담 신청서에 바로 입력해드립니다.',
      serviceLabel: '상담 분야',
      servicePlaceholder: '상담 분야 선택',
      services: {
        stemcell: '일본 줄기세포 치료',
        travel: '한국 뷰티·관광 컨시어지',
        undecided: '상담 후 결정'
      },
      name: '성함',
      phone: '연락처',
      message: '상담 내용',
      namePlaceholder: '홍길동',
      phonePlaceholder: '010-0000-0000',
      messagePlaceholder: '궁금하신 점을 간단히 적어주세요.',
      submit: '상담 폼에 입력하기',
      missing: '성함과 연락처를 입력해주세요.',
      success: '입력해두었습니다. 내용을 확인하고 신청 버튼을 눌러주세요.',
      gateway: '서비스 페이지에서 자세한 상담 신청을 이어갈 수 있습니다.',
      goStemcell: '줄기세포 상담',
      goTravel: '한국여행 상담'
    },
    ja: {
      openLabel: '無料相談チャットを開く',
      closeLabel: '無料相談チャットを閉じる',
      badge: '無料相談',
      title: 'ご相談をお手伝いします',
      intro: '内容を入力すると、相談フォームに反映します。',
      serviceLabel: '相談分野',
      servicePlaceholder: '相談分野を選択',
      services: {
        stemcell: '日本幹細胞治療',
        travel: '韓国美容・観光コンシェルジュ',
        undecided: '相談して決めたい'
      },
      name: 'お名前',
      phone: '連絡先',
      message: '相談内容',
      namePlaceholder: '山田 太郎',
      phonePlaceholder: '+81 90-0000-0000',
      messagePlaceholder: '日程、人数、ご希望内容などをご記入ください。',
      submit: '相談フォームに入力',
      missing: 'お名前と連絡先を入力してください。',
      success: '入力しました。内容を確認して送信してください。',
      gateway: 'サービスページで詳しい相談を続けられます。',
      goStemcell: '幹細胞治療相談',
      goTravel: '韓国旅行相談'
    }
  };

  function optionHtml(value, label, selected) {
    return `<option value="${value}"${selected ? ' selected' : ''}>${label}</option>`;
  }

  function buildWidget() {
    const lang = getLang();
    const t = copy[lang];
    const selectedService = isTravelPage ? 'travel' : isStemcellPage ? 'stemcell' : '';
    const wrap = document.createElement('div');
    wrap.className = 'consult-chat';
    wrap.innerHTML = `
      <section class="consult-chat-panel" id="consult-chat-panel" aria-live="polite">
        <div class="consult-chat-head">
          <div>
            <span>${t.badge}</span>
            <h2>${t.title}</h2>
          </div>
          <button type="button" class="consult-chat-close" aria-label="${t.closeLabel}">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <p class="consult-chat-intro">${document.getElementById('contact-form') ? t.intro : t.gateway}</p>
        ${document.getElementById('contact-form') ? `
          <form class="consult-chat-form">
            <label>
              <span>${t.serviceLabel}</span>
              <select name="service" required>
                ${optionHtml('', t.servicePlaceholder, !selectedService)}
                ${optionHtml('stemcell', t.services.stemcell, selectedService === 'stemcell')}
                ${optionHtml('travel', t.services.travel, selectedService === 'travel')}
                ${optionHtml('undecided', t.services.undecided, false)}
              </select>
            </label>
            <label>
              <span>${t.name}</span>
              <input type="text" name="name" placeholder="${t.namePlaceholder}" required />
            </label>
            <label>
              <span>${t.phone}</span>
              <input type="tel" name="phone" placeholder="${t.phonePlaceholder}" required />
            </label>
            <label>
              <span>${t.message}</span>
              <textarea name="message" rows="3" placeholder="${t.messagePlaceholder}"></textarea>
            </label>
            <p class="consult-chat-status" role="status"></p>
            <button type="submit" class="consult-chat-submit">
              <i class="fas fa-paper-plane"></i>
              <span>${t.submit}</span>
            </button>
          </form>
        ` : `
          <div class="consult-chat-links">
            <a href="stemcell/#contact">${t.goStemcell}</a>
            <a href="korea-travel/#contact">${t.goTravel}</a>
          </div>
        `}
      </section>
      <button type="button" class="consult-chat-toggle" aria-label="${t.openLabel}" aria-expanded="false" aria-controls="consult-chat-panel">
        <i class="fas fa-comments"></i>
        <span>${t.badge}</span>
      </button>
    `;
    document.body.appendChild(wrap);
    return wrap;
  }

  function setField(form, name, value) {
    const field = form.elements[name];
    if (!field || value === undefined || value === null || value === '') return;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillContactForm(chatForm, status) {
    const lang = getLang();
    const t = copy[lang];
    const contactForm = document.getElementById('contact-form');
    const data = new FormData(chatForm);
    const name = String(data.get('name') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    const message = String(data.get('message') || '').trim();
    const service = String(data.get('service') || '').trim();

    if (!name || !phone) {
      status.textContent = t.missing;
      status.classList.add('is-error');
      return;
    }

    const serviceLabel = service ? t.services[service] : '';
    const mergedMessage = [serviceLabel && `[${serviceLabel}]`, message].filter(Boolean).join('\n');

    setField(contactForm, 'name', name);
    setField(contactForm, 'phone', phone);
    setField(contactForm, 'message', mergedMessage);
    if (serviceLabel) setField(contactForm, 'package', serviceLabel);

    status.textContent = t.success;
    status.classList.remove('is-error');

    document.querySelector('.consult-chat')?.classList.remove('open');
    document.querySelector('.consult-chat-toggle')?.setAttribute('aria-expanded', 'false');
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const widget = buildWidget();
    const toggle = widget.querySelector('.consult-chat-toggle');
    const close = widget.querySelector('.consult-chat-close');
    const form = widget.querySelector('.consult-chat-form');
    const status = widget.querySelector('.consult-chat-status');

    toggle.addEventListener('click', () => {
      const isOpen = widget.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    close.addEventListener('click', () => {
      widget.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });

    if (form && status) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        fillContactForm(form, status);
      });
    }
  });
})();
