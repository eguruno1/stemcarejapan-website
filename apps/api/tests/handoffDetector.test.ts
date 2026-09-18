import { describe, expect, it } from 'vitest';
import { detectHandoffSignals, shouldHandoff } from '../src/ai/handoffDetector';

describe('detectHandoffSignals', () => {
  it('한국어 가격 문의를 감지한다', () => {
    expect(detectHandoffSignals('비용이 얼마나 드나요?')).toContain('가격문의');
    expect(detectHandoffSignals('견적 좀 알려주세요')).toContain('가격문의');
  });

  it('일본어 가격 문의를 감지한다', () => {
    expect(detectHandoffSignals('料金はいくらですか')).toContain('가격문의');
    expect(detectHandoffSignals('費用を教えてください')).toContain('가격문의');
  });

  it('예약 요청을 감지한다', () => {
    expect(detectHandoffSignals('9월 15일로 예약하고 싶어요')).toContain('예약요청');
    expect(detectHandoffSignals('予約をお願いします')).toContain('예약요청');
  });

  it('건강 상태 언급을 감지한다', () => {
    expect(detectHandoffSignals('제가 당뇨가 있는데 시술 가능한가요')).toContain('건강상태언급');
    expect(detectHandoffSignals('持病がありますが施術できますか')).toContain('건강상태언급');
  });

  it('운영자 직접 요청을 감지한다', () => {
    expect(detectHandoffSignals('직원과 상담하고 싶습니다')).toContain('운영자요청');
    expect(detectHandoffSignals('担当者と話したいです')).toContain('운영자요청');
  });

  it('불만/긴급을 감지한다', () => {
    expect(detectHandoffSignals('환불해 주세요')).toContain('불만');
    expect(detectHandoffSignals('緊急です')).toContain('긴급');
  });

  it('일반 문의는 아무 신호도 없다', () => {
    expect(detectHandoffSignals('공항 픽업이 가능한가요?')).toEqual([]);
    expect(detectHandoffSignals('こんにちは')).toEqual([]);
  });

  it('한 문장에서 여러 신호를 모두 찾는다', () => {
    const signals = detectHandoffSignals('비용이 얼마인지 알려주시고 9월로 예약해주세요');

    expect(signals).toContain('가격문의');
    expect(signals).toContain('예약요청');
  });
});

describe('shouldHandoff', () => {
  it('신호가 있으면 전환한다', () => {
    const result = shouldHandoff({ text: '비용이 얼마인가요?', unansweredCount: 0 });

    expect(result.required).toBe(true);
    expect(result.reason).toContain('가격문의');
  });

  it('신호가 없고 AI가 잘 답하고 있으면 전환하지 않는다', () => {
    const result = shouldHandoff({ text: '공항 픽업 되나요?', unansweredCount: 0 });

    expect(result.required).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('AI가 2번 이상 제대로 답하지 못했으면 전환한다', () => {
    const result = shouldHandoff({ text: '음 그러니까요', unansweredCount: 2 });

    expect(result.required).toBe(true);
    expect(result.reason).toContain('반복');
  });
});
