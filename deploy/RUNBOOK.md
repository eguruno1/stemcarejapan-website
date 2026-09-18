# 장애 대응 매뉴얼

각 항목은 "증상 → 확인 → 조치" 순서다. 당황하지 말고 위에서부터 따라간다.

## 0. 먼저 볼 곳

```bash
cd deploy
docker compose -f docker-compose.prod.yml ps            # 어떤 서비스가 죽었나
docker compose -f docker-compose.prod.yml logs --tail=100 api
curl -s https://$DOMAIN/api/health                       # API 살아 있나
```

관리자 화면 `/admin/chats/ops` 에서 지표를 본다.

---

## 1. 번역 API 장애

**증상**: 운영 현황의 `번역 실패 (24h)` 가 급증. 운영자 화면에 "번역 실패" 가 많다.

**확인**
```bash
docker compose -f docker-compose.prod.yml logs api | grep translate | tail -20
```

**조치**
1. **상담을 멈추지 않는다.** 원문 메시지는 계속 저장·전달되고 있다.
2. 운영자에게 "번역이 일시 중단됐으니 직접 작성해달라" 고 공지한다.
   - 운영자는 작성 언어를 `일본어` 로 바꿔 직접 쓸 수 있다.
3. OpenAI 상태 페이지를 확인한다.
4. 복구되면 실패한 메시지에서 `다시 시도` 를 누른다.

**공지 문구 (고객용, 필요 시)**
> 현재 자동 번역이 지연되고 있습니다. 상담은 정상적으로 접수되고 있으며 담당자가 확인 후 답변드립니다.

---

## 2. AI 응답 장애

**증상**: 상담을 시작해도 AI 인사 뒤 답변이 없다. 모든 상담이 `운영자 대기` 로 몰린다.

**확인**
```bash
docker compose -f docker-compose.prod.yml logs api | grep consultationBot | tail -20
```

**조치**
1. **이것은 설계된 동작이다.** AI가 실패하면 자동으로 운영자에게 넘어간다.
2. 운영자 인원을 늘려 대기 상담을 처리한다.
3. `OPENAI_API_KEY` 가 만료/한도 초과인지 확인한다.
4. 장기화되면 AI 없이도 운영이 가능하다. 서두르지 않는다.

---

## 3. 실시간 연결 장애

**증상**: 관리자 화면 헤더에 `재연결 중 · 주기 조회로 동작` 이 계속 뜬다.

**확인**
```bash
docker compose -f docker-compose.prod.yml logs nginx | grep -i "upgrade\|websocket" | tail
docker compose -f docker-compose.prod.yml logs api | grep socket | tail
```

**조치**
1. **채팅은 폴링으로 계속 동작한다.** 급하지 않다.
2. Nginx 의 `/socket.io/` 블록에 `proxy_set_header Upgrade` 와 `Connection "upgrade"` 가 있는지 확인한다.
3. `docker compose -f docker-compose.prod.yml restart nginx`
4. 그래도 안 되면 `restart api`

---

## 4. DB 장애

**증상**: `/api/health` 는 되는데 상담 시작이 500. 운영 현황의 `DB` 가 `장애`.

**확인**
```bash
docker compose -f docker-compose.prod.yml ps postgres
docker compose -f docker-compose.prod.yml logs postgres --tail=50
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U $POSTGRES_USER
```

**조치**
1. 디스크 용량을 먼저 본다. `df -h` — 가득 차면 PostgreSQL 이 멈춘다.
2. `docker compose -f docker-compose.prod.yml restart postgres`
3. 복구가 안 되면 **홈페이지에 임시 안내를 띄운다.**
   - 상담 위젯 대신 전화/이메일 안내를 노출한다.
4. 데이터가 손상됐다면 백업에서 복구한다 (`deploy/backup/restore.sh`).

**고객 안내 문구**
> 현재 온라인 상담이 일시적으로 어렵습니다. 전화(000-0000-0000) 또는 이메일로 문의해주세요.

---

## 5. 응답 지연 (운영자 대기가 쌓임)

**증상**: 운영 현황의 `10분 이상 무응답` 이 0 이 아니다.

**조치**
1. `운영자 대기` 필터로 오래 기다린 순 정렬해서 순서대로 처리한다.
2. 반복되면 운영자 근무 시간을 조정하거나, AI FAQ 범위를 넓힌다 (Phase 11).

---

## 6. HTTPS 인증서 만료

**증상**: 브라우저에 보안 경고. 소켓 연결 실패.

**확인**
```bash
echo | openssl s_client -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates
```

**조치**
```bash
docker compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal
docker compose -f docker-compose.prod.yml restart nginx
```

certbot 컨테이너가 12시간마다 자동 갱신하므로 보통은 일어나지 않는다.
일어났다면 certbot 컨테이너가 죽어 있었을 가능성이 크다. `ps` 로 확인한다.

---

## 7. 배포 직후 문제

**즉시 롤백한다.** 원인 분석은 롤백 후에 한다.

```bash
cd deploy
git log --oneline -5
git checkout <직전-정상-커밋>
docker compose -f docker-compose.prod.yml up -d --build
```

DB 마이그레이션이 포함된 배포였다면 롤백만으로 부족하다.
`deploy/DEPLOY.md` 의 롤백 주의사항을 참고한다.
