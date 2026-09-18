import type { DetectedLanguage, Language } from '@stemcare/shared';

// 한글 음절 + 자모
const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/g;
// 히라가나 + 가타카나
const KANA = /[぀-ゟ゠-ヿ]/g;
// CJK 한자 (한국어에도 쓰이지만 현대 한국어 상담에서는 드물다)
const KANJI = /[一-鿿]/g;

/**
 * 규칙 기반 언어 감지.
 *
 * AI를 부르지 않는 이유:
 * - 메시지마다 API를 부르면 비용과 지연이 크다.
 * - 한/일 두 언어만 구분하면 되므로 문자 종류만 봐도 충분히 정확하다.
 */
export function detectLanguage(text: string): DetectedLanguage {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'unknown';

  const hangulCount = (trimmed.match(HANGUL) ?? []).length;
  const kanaCount = (trimmed.match(KANA) ?? []).length;
  const kanjiCount = (trimmed.match(KANJI) ?? []).length;

  if (hangulCount === 0 && kanaCount === 0 && kanjiCount === 0) return 'unknown';

  // 가나가 있으면 확실히 일본어다. 한글보다 가나가 많으면 일본어.
  if (kanaCount > hangulCount) return 'ja';
  if (hangulCount > kanaCount) return 'ko';

  // 둘 다 없고 한자만 있으면 일본 고객이 주 대상이므로 일본어로 본다.
  if (hangulCount === 0 && kanaCount === 0 && kanjiCount > 0) return 'ja';

  return 'unknown';
}

export function oppositeLanguage(lang: Language): Language {
  return lang === 'ko' ? 'ja' : 'ko';
}

/** 감지 실패 시 쓸 기본값을 정한다. */
export function resolveLanguage(detected: DetectedLanguage, fallback: Language): Language {
  return detected === 'unknown' ? fallback : detected;
}
