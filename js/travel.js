/* Travel pages: local-only quote drafts. No inquiry is sent without the user sending email. */
(() => {
  'use strict';
  let language = 'ja';
  try { language = localStorage.getItem('scj-travel-lang') === 'ko' ? 'ko' : 'ja'; } catch (_) {}
  const form = document.getElementById('quote-form');
  const service = document.getElementById('service');
  const fieldRoot = document.getElementById('service-fields');
  const status = document.getElementById('form-status');
  const output = document.getElementById('quote-output');
  const fields = {
    airport: [['airport', '空港（仁川・金浦）', '공항 (인천·김포)'], ['destination', '送迎区間・ホテル名', '송영 구간·호텔명'], ['luggage', '荷物の個数・サイズ', '짐 개수·크기']],
    'seoul-tour': [['pickup', '出発エリア・ホテル名', '출발 지역·호텔명'], ['course', '希望コース・訪問先', '희망 코스·방문처']],
    business: [['hours', '利用時間帯', '이용 시간대'], ['area', '訪問地域・訪問先', '방문 지역·방문처'], ['specialty', '通訳分野・業務内容', '통역 분야·업무 내용']]
  };
  const drafts = {};
  let activeService = service.value;
  function renderFields(save = true) {
    if (save) {
      drafts[activeService] = Object.fromEntries([...fieldRoot.querySelectorAll('input')].map(input => [input.name, input.value]));
    }
    activeService = service.value;
    fieldRoot.replaceChildren();
    for (const [name, ja, ko] of fields[activeService]) {
      const label = document.createElement('label');
      const span = document.createElement('span');
      span.dataset.ja = ja; span.dataset.ko = ko;
      span.textContent = language === 'ko' ? ko : ja;
      const input = document.createElement('input');
      input.name = name; input.id = name; input.maxLength = 300;
      input.value = drafts[activeService]?.[name] || '';
      label.append(span, input); fieldRoot.append(label);
    }
  }
  function setLanguage(lang) {
    language = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-ja][data-ko]').forEach(el => { el.textContent = el.dataset[lang]; });
    document.querySelectorAll('[data-language]').forEach(button => {
      button.classList.toggle('active', button.dataset.language === lang);
      button.setAttribute('aria-pressed', String(button.dataset.language === lang));
    });
    document.getElementById('menu-toggle').setAttribute('aria-label', lang === 'ja' ? 'メニューを開閉' : '메뉴 열기·닫기');
    status.textContent = ''; output.hidden = true;
    try { localStorage.setItem('scj-travel-lang', lang); } catch (_) {}
  }
  renderFields(false); setLanguage(language);
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language)));
  service.addEventListener('change', () => { renderFields(); status.textContent = ''; output.hidden = true; });
  form.addEventListener('input', () => { status.textContent = ''; output.hidden = true; });
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('navigation');
  function closeMenu() { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
  toggle.addEventListener('click', () => { const open = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); } });
  form.elements.date.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  form.elements.name.autocomplete = 'name'; form.elements.email.autocomplete = 'email';
  function makeDraft() {
    if (!form.reportValidity()) return null;
    const data = new FormData(form);
    const ja = language === 'ja';
    const product = service.selectedOptions[0].textContent;
    const rows = [ja ? '見積もりを希望します。' : '견적 상담을 요청합니다.', '', `${ja ? 'サービス' : '상품'}: ${product}`, `${ja ? '利用日' : '이용일'}: ${data.get('date')}`, `${ja ? '人数' : '인원'}: ${data.get('people')}`];
    for (const [name, jp, kr] of fields[service.value]) rows.push(`${ja ? jp : kr}: ${data.get(name) || '—'}`);
    rows.push(`${ja ? 'お名前' : '성함'}: ${data.get('name')}`, `Email: ${data.get('email')}`, '', `${ja ? 'その他のご希望' : '추가 요청 사항'}:`, data.get('message') || '—');
    return { subject: `[StemCareJapan] ${product} / ${data.get('date')}`, body: rows.join('\n') };
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    const draft = makeDraft(); if (!draft) return;
    output.value = `${draft.subject}\n\n${draft.body}`; output.hidden = false;
    status.textContent = language === 'ja' ? 'まだ送信されていません。メールアプリで内容を確認して送信してください。開かない場合は内容をコピーし、上記アドレスへお送りください。' : '아직 전송되지 않았습니다. 메일 앱에서 내용을 확인하고 전송하세요. 열리지 않으면 내용을 복사해 위 이메일 주소로 보내주세요.';
    window.location.href = `mailto:info@stemcarejapan.com?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
  });
  document.getElementById('copy-quote').addEventListener('click', async () => {
    const draft = makeDraft(); if (!draft) return;
    const text = `${draft.subject}\n\n${draft.body}`;
    output.value = text; output.hidden = false;
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = language === 'ja' ? 'コピーしました。メールに貼り付けて送信してください。まだ送信されていません。' : '복사했습니다. 이메일에 붙여넣고 전송해 주세요. 아직 전송되지 않았습니다.';
    } catch (_) {
      output.focus(); output.select();
      status.textContent = language === 'ja' ? '下の文章を選択してコピーし、メールでお送りください。' : '아래 내용을 선택해 복사한 후 이메일로 보내주세요.';
    }
  });
})();
