/**
 * 보관 기간 정리를 수동으로 한 번 실행한다. (cron 없이 즉시 확인하고 싶을 때)
 *
 * `tsx -e "import(...).then(...)"` 인라인 실행은 이 워크스페이스처럼 "type": "module"
 * 이 없는 CJS 패키지에서 동적 import 의 named export 가 module.default 아래로
 * 감싸여서 실패한다 (`m.runRetention is not a function`). db:seed 와 같은
 * 방식으로 일반 스크립트 파일을 둔다.
 */
import { runRetention } from '../src/ops/retention';

runRetention()
  .then((result) => {
    console.log(result);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
