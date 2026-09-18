import { afterEach, describe, expect, it, vi } from 'vitest';
import { setModelCaller } from '../src/ai/aiClient';
import { detectLanguage, oppositeLanguage } from '../src/ai/languageDetector';
import { translate } from '../src/ai/translator';

afterEach(() => {
  setModelCaller(null);
});

describe('detectLanguage', () => {
  it('한글이 있으면 ko 로 판별한다', () => {
    expect(detectLanguage('다음 달에 어머니와 한국에 가고 싶습니다.')).toBe('ko');
  });

  it('히라가나/가타카나가 있으면 ja 로 판별한다', () => {
    expect(detectLanguage('来月、母と2人で韓国に行きたいです。')).toBe('ja');
    expect(detectLanguage('ホテルの予約')).toBe('ja');
  });

  it('한자만 있으면 ja 로 본다 (일본 고객이 주 대상)', () => {
    expect(detectLanguage('韓国旅行')).toBe('ja');
  });

  it('한글과 가나가 섞이면 더 많은 쪽을 고른다', () => {
    expect(detectLanguage('안녕하세요 안녕하세요 안녕하세요 こんにちは')).toBe('ko');
  });

  it('숫자나 영문만 있으면 unknown 이다', () => {
    expect(detectLanguage('OK 12345')).toBe('unknown');
    expect(detectLanguage('   ')).toBe('unknown');
  });
});

describe('oppositeLanguage', () => {
  it('ko 의 반대는 ja 다', () => {
    expect(oppositeLanguage('ko')).toBe('ja');
    expect(oppositeLanguage('ja')).toBe('ko');
  });
});

describe('translate', () => {
  it('모델 응답을 번역문으로 돌려준다', async () => {
    setModelCaller(async () => 'ご訪問予定日を教えてください。');

    const result = await translate({
      text: '방문 예정일을 알려주세요.',
      source: 'ko',
      target: 'ja'
    });

    expect(result.status).toBe('done');
    if (result.status === 'done') {
      expect(result.text).toBe('ご訪問予定日を教えてください。');
    }
  });

  it('원문과 목표 언어가 같으면 호출 없이 원문을 돌려준다', async () => {
    const caller = vi.fn();
    setModelCaller(caller);

    const result = await translate({ text: '안녕하세요', source: 'ko', target: 'ko' });

    expect(result.status).toBe('skipped');
    expect(caller).not.toHaveBeenCalled();
  });

  it('빈 문자열은 호출 없이 skipped 다', async () => {
    const caller = vi.fn();
    setModelCaller(caller);

    const result = await translate({ text: '   ', source: 'ko', target: 'ja' });

    expect(result.status).toBe('skipped');
    expect(caller).not.toHaveBeenCalled();
  });

  it('모델이 실패하면 failed 를 돌려준다 (예외를 던지지 않는다)', async () => {
    setModelCaller(async () => {
      throw new Error('rate limit');
    });

    const result = await translate({ text: '안녕하세요', source: 'ko', target: 'ja' });

    expect(result.status).toBe('failed');
  });

  it('모델이 빈 응답을 주면 failed 다', async () => {
    setModelCaller(async () => '   ');

    const result = await translate({ text: '안녕하세요', source: 'ko', target: 'ja' });

    expect(result.status).toBe('failed');
  });

  it('모델이 따옴표를 붙여도 벗겨낸다', async () => {
    setModelCaller(async () => '"ご訪問予定日を教えてください。"');

    const result = await translate({ text: '방문 예정일', source: 'ko', target: 'ja' });

    expect(result.status).toBe('done');
    if (result.status === 'done') {
      expect(result.text).toBe('ご訪問予定日を教えてください。');
    }
  });

  it('너무 긴 원문은 잘라서 보낸다', async () => {
    let receivedLength = 0;
    setModelCaller(async ({ user }) => {
      receivedLength = user.length;
      return '번역';
    });

    await translate({ text: 'あ'.repeat(5000), source: 'ja', target: 'ko' });

    expect(receivedLength).toBeLessThanOrEqual(2000);
  });
});
