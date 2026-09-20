import { config } from '../config';
import type { ModelCallInput } from './aiClient';

/** API 서버에서만 접근한다. 브라우저가 URL이나 모델을 임의로 지정할 수 없다. */
export async function callOllama(input: ModelCallInput): Promise<string> {
  const response = await fetch(`${config.ollamaBaseUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(input.timeoutMs),
    body: JSON.stringify({ model: config.ollamaModel, stream: false, think: false, keep_alive: '10m',
      options: { temperature: 0, num_predict: 4096 },
      messages: [{ role: 'system', content: input.system }, { role: 'user', content: input.user }] })
  });
  if (!response.ok) throw new Error('OLLAMA_UNAVAILABLE');
  const body = await response.json() as { message?: { content?: unknown }; done?: boolean; done_reason?: string };
  if (body.done !== true || body.done_reason === 'length' || typeof body.message?.content !== 'string') throw new Error('OLLAMA_INVALID_RESPONSE');
  const content = body.message.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!content || /<\/?think>/i.test(content)) throw new Error('OLLAMA_EMPTY_RESPONSE');
  return content;
}
