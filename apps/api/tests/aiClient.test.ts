import { afterEach, describe, expect, it } from 'vitest';
import { AiUnavailableError, callModel, setModelCaller } from '../src/ai/aiClient';

afterEach(() => {
  setModelCaller(null);
});

describe('aiClient', () => {
  it('주입된 caller 를 그대로 사용한다', async () => {
    let calls = 0;
    setModelCaller(async () => {
      calls += 1;
      return '가짜 응답';
    });

    const result = await callModel({
      model: 'test-model',
      system: '시스템',
      user: '사용자',
      timeoutMs: 1000
    });

    expect(result).toBe('가짜 응답');
    expect(calls).toBe(1);
  });

  it('caller 가 던진 오류는 AiUnavailableError 로 감싼다', async () => {
    setModelCaller(async () => {
      throw new Error('rate limit');
    });

    await expect(
      callModel({ model: 'm', system: 's', user: 'u', timeoutMs: 1000 })
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it('API 키가 없고 caller 도 없으면 AiUnavailableError 를 던진다', async () => {
    // config.openaiApiKey 는 테스트 환경에서 빈 문자열이다.
    await expect(
      callModel({ model: 'm', system: 's', user: 'u', timeoutMs: 1000 })
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it('타임아웃을 넘기면 AiUnavailableError 를 던진다', async () => {
    setModelCaller(
      () => new Promise((resolve) => setTimeout(() => resolve('늦은 응답'), 500))
    );

    await expect(
      callModel({ model: 'm', system: 's', user: 'u', timeoutMs: 50 })
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
