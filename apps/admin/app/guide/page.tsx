'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/Button';

const TOC = [
  { href: '#login', label: '1. 로그인' },
  { href: '#layout', label: '2. 화면 구성' },
  { href: '#list', label: '3. 상담 목록 보는 법' },
  { href: '#reply', label: '4. 상담방에서 답변하기' },
  { href: '#translate', label: '5. 번역 미리보기' },
  { href: '#status', label: '6. 상담 상태 바꾸기 · 배정' },
  { href: '#customer', label: '7. 고객 정보 · 이전 상담 · 메모' },
  { href: '#realtime', label: '8. 실시간 연결 표시' },
  { href: '#ops', label: '9. 운영 현황 대시보드' },
  { href: '#faq', label: '10. 자주 묻는 질문' },
  { href: '#rules', label: '11. 꼭 지켜야 할 것' }
];

function Section({
  id,
  title,
  children
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginTop: 34, scrollMarginTop: 16 }}>
      <h2 style={{ fontSize: 15, margin: '0 0 10px', color: 'var(--text)' }}>{title}</h2>
      <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>{children}</div>
    </section>
  );
}

function Tag({ children, color = 'var(--accent)' }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        color,
        border: `1px solid ${color}`,
        borderRadius: 4,
        padding: '0 5px',
        marginRight: 6
      }}
    >
      {children}
    </span>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '8px 10px',
        margin: '10px 0 0',
        fontSize: 12,
        color: 'var(--text-muted)'
      }}
    >
      {children}
    </p>
  );
}

export default function OperatorGuidePage() {
  const router = useRouter();
  const { operator, status } = useAuth();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated' || !operator) {
    return (
      <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>확인 중…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, padding: '24px 24px 80px', margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, margin: '0 0 6px' }}>상담 관리자 이용 가이드</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px' }}>
        상담채팅에 들어온 고객 문의를 확인하고 답변하는 화면의 사용법입니다. 처음 배정받으셨다면
        아래 순서대로 한 번 읽어보시길 권합니다.
      </p>

      <nav
        aria-label="목차"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 8
        }}
      >
        {TOC.map((item) => (
          <a key={item.href} href={item.href} style={{ fontSize: 12 }}>
            {item.label}
          </a>
        ))}
      </nav>

      <Section id="login" title="1. 로그인">
        <p>
          관리자 화면 주소의 <code>/login</code> (운영 배포에서는 <code>/admin/login</code>) 에서 이메일과 비밀번호로 로그인합니다. 계정이
          없거나 비밀번호를 잊었다면 관리자(운영 담당자)에게 문의하세요 — 비밀번호를 스스로
          재설정하는 화면은 아직 제공되지 않습니다.
        </p>
        <p>
          로그인 없이 상담 목록 화면(<code>/chats</code>)에 접근하면 자동으로 로그인 화면으로
          이동합니다. 로그인 요청을 짧은 시간에 여러 번 연속으로 보내면 보안을 위해 잠시 시도가
          제한됩니다 — 몇 분 후 다시 시도하면 됩니다.
        </p>
      </Section>

      <Section id="layout" title="2. 화면 구성">
        <p>로그인하면 화면이 세 영역으로 나뉩니다.</p>
        <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
          <li><strong>왼쪽 — 상담 목록</strong>: 지금까지 들어온 상담방 전체 목록</li>
          <li><strong>가운데 — 대화 내용</strong>: 선택한 상담방의 메시지 (원문 + 번역문)</li>
          <li><strong>오른쪽 — 고객 정보 패널</strong>: 상태 변경, 고객 정보, 이전 상담, 메모</li>
        </ul>
        <p>
          상단 헤더에는 <strong>운영 현황</strong>(9장), 내 이름과 권한, <strong>설정</strong>
          (내 계정 확인·로그아웃), 그리고 이 페이지로 오는 <strong>이용가이드</strong> 링크가
          있습니다.
        </p>
      </Section>

      <Section id="list" title="3. 상담 목록 보는 법">
        <p>
          목록 위쪽의 필터로 <Tag>전체</Tag><Tag>운영자 대기</Tag><Tag>진행 중</Tag>
          <Tag>AI 상담 중</Tag><Tag>완료</Tag> 상태별로 걸러볼 수 있고, 정렬 방식도 바꿀 수
          있습니다. 각 상담방 옆의 숫자 배지는 <strong>안 읽은 메시지 개수</strong>입니다.
        </p>
        <Note>
          읽음은 운영자별이 아닌 상담방 공통 상태입니다. 한 운영자가 방을 읽으면 다른 운영자의 목록에도 반영됩니다. 실시간으로 입장한 방의 새 메시지는 읽음 처리되지만, 연결·조회 지연 중에는 숫자가 잠시 남을 수 있습니다.
        </Note>
      </Section>

      <Section id="reply" title="4. 상담방에서 답변하기">
        <p>
          먼저 「내가 상담하기」로 담당 여부와 진행 중 상태를 확인한 뒤 하단 입력창에 답변을 쓰고 전송합니다. AI 상담 중에 상태를 바꾸지 않고 답변하면 AI가 다시 개입할 수 있습니다. 입력창 옆에서 <strong>지금 내가 쓰는 언어</strong>
          (기본 한국어)를 고를 수 있습니다 — 이것은 고객이 선호하는 언어와는 별개입니다.
        </p>
        <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
          <li>한글·일본어 입력 중 조합 확정 Enter는 전송으로 처리되지 않습니다 — 실수로 미완성
            문장이 전송되는 것을 막기 위해서입니다.</li>
          <li>전송이 실패하면 같은 내용으로 재시도할 수 있고, 같은 메시지로 처리되어 중복
            전송되지 않습니다.</li>
          <li>메시지의 번역이 실패했다고 표시되면 그 메시지 옆의 <strong>다시 번역</strong>
            버튼으로 재번역을 요청할 수 있습니다. 번역이 실패해도 원문은 이미 정상적으로
            전달된 상태이므로 상담을 계속 진행해도 됩니다.</li>
        </ul>
      </Section>

      <Section id="translate" title="5. 번역 미리보기">
        <p>
          내가 쓰는 언어가 고객의 선호 언어와 다르면, 전송 버튼을 누르는 순간 자동 번역된
          <strong> 미리보기</strong>가 뜹니다.
        </p>
        <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
          <li>번역문이 어색하면 직접 고칠 수 있습니다 — 고치면 <em>직접 수정</em> 표시가 붙습니다.</li>
          <li>미리보기에서 확인 후 <strong>이대로 전송</strong>하거나 <strong>취소</strong>할 수 있습니다.</li>
          <li>고객 화면에는 <strong>번역된 문장만</strong> 보입니다. 내가 쓴 원문은 보이지
            않습니다.</li>
        </ul>
        <Note>자동 번역이 실패하면 번역문을 직접 입력해 전송할 수 있습니다. 숫자·금액·날짜·고유명사를 확인하세요. 미리보기는 아직 고객에게 전송된 상태가 아니며 상담이 종료되면 전송할 수 없습니다.</Note>
      </Section>

      <Section id="status" title="6. 상담 상태 바꾸기 · 배정">
        <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
          <li><strong>내가 상담하기</strong>를 누르면 그 상담이 나에게 배정되고 상태가
            <Tag color="#1a7f37">진행 중</Tag>으로 바뀝니다. 고객 화면에도 반영됩니다. 다른 운영자에게 이미 배정된 방은 가져올 수 없으므로 담당자와 먼저 조율하세요.</li>
          <li>상태는 <Tag>운영자 대기</Tag><Tag color="#1a7f37">진행 중</Tag>
            <Tag color="#c02b2b">종료</Tag> 로 직접 바꿀 수 있습니다.</li>
          <li><strong>상담 종료</strong>를 누르면 고객·운영자 양쪽 입력창이 잠기고, 고객
            화면에는 만족도 평가 요청이 표시됩니다.</li>
          <li>종료된 상담도 다시 <strong>진행 중</strong>으로 되돌려 재개할 수 있습니다. 기존 담당자가 유지될 수 있으므로 배정을 확인하세요. 재개해도 이미 제출한 평가는 초기화되지 않습니다.</li>
        </ul>
      </Section>

      <Section id="customer" title="7. 고객 정보 · 이전 상담 · 메모">
        <p>
          오른쪽 패널에서 고객의 성함·연락처·이메일·선호 언어·희망 서비스·유입 페이지·상담
          시작 시각을 확인할 수 있습니다.
        </p>
        <p>
          <strong>이전 상담</strong> 목록에는 같은 고객의 과거 상담이 최대 20건 표시됩니다.
        </p>
        <Note>
          현재는 고객이 상담을 새로 시작할 때마다 새 고객 정보로 등록됩니다. 이름·연락처가
          같아도 자동으로 하나로 묶이지 않을 수 있다는 점을 유의하세요 — 같은 고객인지는
          이름·연락처가 같다는 이유만으로 동일인으로 확정하거나 다른 상담 내용을 전달하지 마세요.
        </Note>
        <p style={{ marginTop: 10 }}>
          <strong>메모</strong>는 운영자만 볼 수 있는 내부 기록입니다. <strong>고객 화면에는
          절대 노출되지 않습니다</strong> — 인수인계나 특이사항 공유에 사용하세요. 입력 후 「메모 저장」을 눌러 기록에 추가되었는지 확인하세요. AI 요약과 위험 태그는 참고 정보이므로 원문을 확인하고 필요한 정정은 메모에 남겨주세요.
        </p>
      </Section>

      <Section id="realtime" title="8. 실시간 연결 표시">
        <p>
          상담방 상단에 <strong style={{ color: '#1a7f37' }}>실시간 연결됨</strong>이 보이면
          정상입니다. <strong style={{ color: '#c07a2b' }}>재연결 중 · 주기 조회로 동작</strong>이
          보이면 실시간 연결(소켓)이 끊겨 몇 초 간격의 자동 새로고침(폴링)으로 대신 동작하고
          있는 상태입니다. API 서버에 연결할 수 있어야 조회·전송이 가능합니다. 오류가 계속되면 전송 성공 여부를 확인하고 운영 담당자에게 알려주세요. 접속 표시는 고객이 실제로 메시지를 읽었다는 증거는 아닙니다.
        </p>
      </Section>

      <Section id="ops" title="9. 운영 현황 대시보드">
        <p>
          헤더의 <strong>운영 현황</strong> 링크(<code>/chats/ops</code>)에서 15초마다 자동
          갱신되는 전체 지표를 볼 수 있습니다. 운영 배포 경로는 /admin/chats/ops이며 백그라운드 탭에서는 갱신을 쉽니다.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
          <tbody>
            {[
              ['운영자 대기 / 진행 중 / AI 상담 중', '각 상태의 상담방 수'],
              ['오늘 접수', '한국 시각 00:00 이후 시작된 상담 수'],
              ['10분 이상 무응답', '대기·진행 중 상담에서 마지막 운영자 답변 이후 10분 넘게 남아 있는 고객 메시지가 있는 방 수'],
              ['번역 실패 (24h)', '최근 24시간 동안 번역이 실패한 건수'],
              ['실시간 연결', '현재 소켓 연결 수 (고객·운영자 포함, 사람 수와 다름)'],
              ['DB', '지표 응답의 DB 조회 상태. DB 장애 시 지표 전체를 불러오지 못할 수 있음'],
              ['평균 만족도 (30일)', '최근 30일 고객 평가 평균과 건수']
            ].map(([k, v]) => (
              <tr key={k} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px 6px 0', width: '35%', color: 'var(--text-muted)' }}>{k}</td>
                <td style={{ padding: '6px 0' }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Note>
          조회 오류가 표시되면 화면의 이전 숫자는 최신 값이 아닐 수 있습니다. 지표가 계속 나쁘게 나오거나(대기가 계속 쌓이는 등) 화면 자체가 이상하게 동작하면
          운영·개발 담당자에게 알려주세요.
        </Note>
      </Section>

      <Section id="faq" title="10. 자주 묻는 질문">
        <dl style={{ margin: 0 }}>
          {[
            ['로그인이 안 돼요.', '이메일·비밀번호를 다시 확인하세요. 여러 번 연속 실패하면 잠시 후(몇 분 뒤) 다시 시도해야 합니다.'],
            ['자동 번역이 이상해요.', '전송 전 미리보기(5장)에서 직접 고쳐서 보낼 수 있습니다.'],
            ['번역이 실패했다고 나와요.', '고객 메시지 옆 다시 번역 버튼을 누르세요. 원문은 이미 정상 전달된 상태이니 상담은 계속 진행해도 됩니다.'],
            ['같은 고객의 예전 상담이 안 보여요.', '7장 참고 — 상담마다 새 고객으로 등록될 수 있어 자동으로 묶이지 않을 수 있습니다.'],
            ['실수로 상담을 종료했어요.', '상태를 다시 진행 중으로 바꾸면 재개할 수 있습니다.'],
            ['비밀번호를 바꾸고 싶어요.', '아직 화면 기능이 없습니다. 관리자에게 문의해 재설정을 요청하세요.']
          ].map(([q, a]) => (
            <div key={q} style={{ marginBottom: 10 }}>
              <dt style={{ fontWeight: 600, fontSize: 13 }}>Q. {q}</dt>
              <dd style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>A. {a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="rules" title="11. 꼭 지켜야 할 것">
        <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
          <li>AI 답변·요약·번역을 확인 없이 확정 안내로 사용하지 않습니다. 가격·예약·의료 관련 판단은 담당 절차에 따라 확인합니다.</li>
          <li>업무를 마치면 설정에서 로그아웃하고, 공용 기기에 로그인 상태를 남기지 않습니다.</li>
          <li>메모나 상담 내용을 이 화면 밖(개인 메신저, 메일 등)으로 옮기지 않습니다.</li>
          <li>고객의 개인정보(연락처·이메일 등)는 상담 목적 외에 사용하지 않습니다.</li>
          <li>사기 의심, 심각한 컴플레인 등 이상 징후가 보이면 즉시 관리자에게 공유합니다.</li>
        </ul>
      </Section>

      <div style={{ display: 'flex', gap: 8, marginTop: 40 }}>
        <Button variant="secondary" onClick={() => router.push('/chats')}>
          상담 목록으로
        </Button>
      </div>
    </main>
  );
}
