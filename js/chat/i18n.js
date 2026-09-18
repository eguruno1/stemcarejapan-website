/* 위젯 문구 사전. 한국어/일본어 두 벌을 반드시 같은 키로 유지한다. */

export function getLang() {
  const lang = document.documentElement.lang || document.documentElement.dataset.lang || 'ko';
  return lang.startsWith('ja') ? 'ja' : 'ko';
}

const DICT = {
  ko: {
    'open.label': '무료 상담 채팅 열기',
    'close.label': '무료 상담 채팅 닫기',
    'badge': '무료 상담',
    'title': '상담을 도와드릴게요',
    'intro': '아래 내용을 남겨주시면 담당자가 바로 확인합니다.',

    'field.service': '상담 분야',
    'field.service.placeholder': '상담 분야 선택',
    'service.stemcell': '일본 줄기세포 치료',
    'service.korea_travel': '한국 뷰티·관광 컨시어지',
    'service.undecided': '상담 후 결정',
    'field.name': '성함',
    'field.name.placeholder': '홍길동',
    'field.phone': '연락처',
    'field.phone.placeholder': '010-0000-0000',
    'field.email': '이메일 (선택)',
    'field.email.placeholder': 'example@email.com',
    'field.language': '상담 언어',
    'language.ko': '한국어',
    'language.ja': '일본어',
    'field.message': '문의 내용',
    'field.message.placeholder': '궁금하신 점을 간단히 적어주세요.',

    'privacy.label': '개인정보 수집·이용에 동의합니다.',
    'privacy.detail':
      '상담 진행을 위해 성함, 연락처, 문의 내용을 수집하며, 상담 목적 외에는 사용하지 않습니다.',

    'submit.start': '상담 시작하기',
    'submit.starting': '상담방을 만드는 중…',
    'composer.placeholder': '메시지를 입력하세요',
    'composer.send': '전송',
    'handoff': '담당자 연결 요청',

    'status.bot': 'AI 상담 중',
    'status.waiting': '운영자 연결 대기 중',
    'status.active': '운영자 상담 중',
    'status.closed': '상담 종료',

    'newMessages': '새 메시지',
    'sending': '전송 중',
    'sendFailed': '전송 실패 · 다시 시도',
    'retry': '다시 시도',

    'error.required': '성함과 연락처를 입력해주세요.',
    'error.name': '성함을 1~50자로 입력해주세요.',
    'error.phone': '연락처를 5~30자로 입력해주세요.',
    'error.email': '올바른 이메일을 입력해주세요.',
    'error.length': '문의 내용을 2000자 이내로 입력해주세요.',
    'error.privacy': '개인정보 수집·이용에 동의해주세요.',
    'error.service': '상담 분야를 선택해주세요.',
    'error.network': '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
    'error.expired': '상담 세션이 만료되었습니다. 새로 상담을 시작해주세요.',
    'error.closed': '종료된 상담입니다. 새 상담을 시작해주세요.',
    'error.unknown': '문제가 발생했습니다. 잠시 후 다시 시도해주세요.',

    'newChat': '새 상담 시작',
    'handoff.message': '담당자와 상담하고 싶습니다.',

    'peer.typing': '입력 중…',
    'presence.online': '담당자 접속 중',
    'presence.inRoom': '담당자가 상담방에 있습니다',
    'presence.offline': '현재 담당자가 부재중입니다. 메시지를 남겨주시면 확인 후 연락드립니다.',

    'feedback.title': '상담은 어떠셨나요?',
    'feedback.hint': '평가를 남겨주시면 서비스 개선에 활용하겠습니다.',
    'feedback.comment': '남기고 싶은 말씀 (선택)',
    'feedback.submit': '평가 보내기',
    'feedback.thanks': '소중한 의견 감사합니다.',
    'feedback.already': '이미 평가를 남기셨습니다. 감사합니다.',
    'feedback.skip': '건너뛰기'
  },
  ja: {
    'open.label': '無料相談チャットを開く',
    'close.label': '無料相談チャットを閉じる',
    'badge': '無料相談',
    'title': 'ご相談をお手伝いします',
    'intro': '内容をご入力いただければ、担当者がすぐに確認いたします。',

    'field.service': '相談分野',
    'field.service.placeholder': '相談分野を選択',
    'service.stemcell': '日本幹細胞治療',
    'service.korea_travel': '韓国美容・観光コンシェルジュ',
    'service.undecided': '相談して決めたい',
    'field.name': 'お名前',
    'field.name.placeholder': '山田 太郎',
    'field.phone': '連絡先',
    'field.phone.placeholder': '+81 90-0000-0000',
    'field.email': 'メール (任意)',
    'field.email.placeholder': 'example@email.com',
    'field.language': '相談言語',
    'language.ko': '韓国語',
    'language.ja': '日本語',
    'field.message': 'お問い合わせ内容',
    'field.message.placeholder': '日程、人数、ご希望内容などをご記入ください。',

    'privacy.label': '個人情報の収集・利用に同意します。',
    'privacy.detail':
      'ご相談のためにお名前、連絡先、お問い合わせ内容を収集し、相談目的以外には使用しません。',

    'submit.start': '相談を始める',
    'submit.starting': '相談ルームを作成中…',
    'composer.placeholder': 'メッセージを入力',
    'composer.send': '送信',
    'handoff': '担当者につなぐ',

    'status.bot': 'AI相談中',
    'status.waiting': '担当者の接続待ち',
    'status.active': '担当者と相談中',
    'status.closed': '相談終了',

    'newMessages': '新着メッセージ',
    'sending': '送信中',
    'sendFailed': '送信失敗 · 再試行',
    'retry': '再試行',

    'error.required': 'お名前と連絡先を入力してください。',
    'error.name': 'お名前を1〜50文字で入力してください。',
    'error.phone': '連絡先を5〜30文字で入力してください。',
    'error.email': '正しいメールアドレスを入力してください。',
    'error.length': 'お問い合わせは2000文字以内で入力してください。',
    'error.privacy': '個人情報の収集・利用に同意してください。',
    'error.service': '相談分野を選択してください。',
    'error.network': 'サーバーに接続できません。しばらくしてからお試しください。',
    'error.expired': '相談セッションの有効期限が切れました。新しく相談を開始してください。',
    'error.closed': '終了した相談です。新しく相談を開始してください。',
    'error.unknown': '問題が発生しました。しばらくしてからお試しください。',

    'newChat': '新しい相談を開始',
    'handoff.message': '担当者と相談したいです。',

    'peer.typing': '入力中…',
    'presence.online': '担当者がオンラインです',
    'presence.inRoom': '担当者が相談ルームにいます',
    'presence.offline': '現在担当者が不在です。メッセージを残していただければ、確認後ご連絡いたします。',

    'feedback.title': 'ご相談はいかがでしたか。',
    'feedback.hint': '評価をいただけますと、サービス改善に活用いたします。',
    'feedback.comment': 'ご意見（任意）',
    'feedback.submit': '評価を送信',
    'feedback.thanks': '貴重なご意見をありがとうございます。',
    'feedback.already': 'すでに評価をいただいております。ありがとうございます。',
    'feedback.skip': 'スキップ'
  }
};

export function t(key) {
  const lang = getLang();
  return DICT[lang][key] ?? DICT.ko[key] ?? key;
}

/** 테스트/검증용. 두 사전의 키가 같은지 확인할 때 쓴다. */
export function dictKeys() {
  return { ko: Object.keys(DICT.ko), ja: Object.keys(DICT.ja) };
}
