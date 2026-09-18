/**
 * 운영자 전환 판단.
 *
 * AI 프롬프트에만 맡기지 않고 규칙으로도 검사하는 이유:
 * 프롬프트는 확률적이라 가끔 지시를 어긴다. 가격이나 의료 관련 문의에
 * AI가 잘못 답하면 신뢰와 법적 문제가 생기므로, 코드로 확실히 막는다.
 */

const SIGNAL_PATTERNS: Array<{ signal: string; patterns: RegExp[] }> = [
  {
    signal: '가격문의',
    patterns: [/비용|가격|얼마|견적|요금|할인/, /料金|費用|価格|いくら|見積|割引/]
  },
  {
    signal: '예약요청',
    patterns: [/예약|일정\s*확정|날짜\s*잡|자리\s*있/, /予約|日程.*確定|空いて/]
  },
  {
    signal: '건강상태언급',
    patterns: [
      /당뇨|고혈압|암|수술|복용|지병|알레르기|임신|부작용|후유증/,
      /糖尿|高血圧|がん|手術|服用|持病|アレルギー|妊娠|副作用/
    ]
  },
  {
    signal: '의료판단요구',
    patterns: [/효과\s*있|치료\s*되|나을\s*수|받아도\s*되|가능한가요.*시술/, /効果.*あり|治り|受けても|施術.*可能/]
  },
  {
    signal: '운영자요청',
    patterns: [/직원|담당자|상담원|사람.*연결|사람.*바꿔/, /担当者|スタッフ|人.*つない|オペレータ/]
  },
  {
    signal: '불만',
    patterns: [/환불|취소해|불만|화가|항의|실망/, /返金|キャンセル|苦情|不満/]
  },
  {
    signal: '긴급',
    patterns: [/긴급|급해|지금\s*당장|빨리\s*연락/, /緊急|至急|今すぐ/]
  }
];

export function detectHandoffSignals(text: string): string[] {
  const signals: string[] = [];

  for (const { signal, patterns } of SIGNAL_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(text))) {
      signals.push(signal);
    }
  }

  return signals;
}

export function shouldHandoff(input: {
  text: string;
  /** AI가 연속으로 제대로 답하지 못한 횟수 */
  unansweredCount: number;
}): { required: boolean; reason: string | null } {
  const signals = detectHandoffSignals(input.text);

  if (signals.length > 0) {
    return { required: true, reason: signals.join(', ') };
  }

  if (input.unansweredCount >= 2) {
    return { required: true, reason: 'AI가 답하기 어려운 질문이 반복됨' };
  }

  return { required: false, reason: null };
}
