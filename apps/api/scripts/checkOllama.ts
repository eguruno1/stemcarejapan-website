import { callOllama } from '../src/ai/ollamaClient';
import { translationSystemPrompt } from '../src/ai/promptTemplates';
import { config } from '../src/config';

async function main() {
  // 실제 고객 정보 대신 고정된 예제만 사용한다. 외부 API 폴백은 없다.
  for (const sample of [
    { source: 'ja', target: 'ko', text: '明日の午後3時に2名で相談したいです。' },
    { source: 'ko', target: 'ja', text: '상담은 내일 오후 3시이며 인원은 2명입니다. 예약 확정은 담당자가 안내합니다.' }
  ] as const) {
    const started = Date.now();
    const result = await callOllama({ model: config.ollamaModel, system: translationSystemPrompt(sample.source, sample.target), user: sample.text, timeoutMs: config.ollamaTimeoutMs });
    console.log(JSON.stringify({ model: config.ollamaModel, direction: `${sample.source}→${sample.target}`, elapsedMs: Date.now() - started, source: sample.text, translation: result }));
  }
}
main().catch(() => { console.error('로컬 번역 확인 실패: Ollama 실행, 모델 설치, OLLAMA_BASE_URL을 확인해주세요.'); process.exitCode = 1; });
