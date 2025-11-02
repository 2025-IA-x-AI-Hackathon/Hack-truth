import { useScrollReveal } from "../hooks/useScrollReveal.js";

const LandingPage = () => {
  const [featureRef, featureVisible] = useScrollReveal({ threshold: 0.35 });
  const [experienceRef, experienceVisible] = useScrollReveal({
    threshold: 0.2,
  });
  const [installRef, installVisible] = useScrollReveal({ threshold: 0.2 });
  const [ctaRef, ctaVisible] = useScrollReveal({ threshold: 0.5 });

  return (
    <div className="landing">
      <section className="landing__hero">
        <div className="landing__hero-inner">
          <div className="landing__hero-content">
            <p className="landing__eyebrow">
              Chrome Extension · 실시간 팩트체킹
            </p>
            <h1 className="landing__title">
              진실을 가리는 순간,
              <br />
              <span>HackTruth가 곧장 밝힙니다</span>
            </h1>
            <p className="landing__description">
              영상, 이미지, 텍스트까지 브라우저 안에서 클릭 한 번으로
              검증하세요. HackTruth는 감지부터 공유까지 전 과정을 자동화해
              사실에 근거한 커뮤니케이션을 돕습니다.
            </p>
            <ul className="landing__hero-highlights">
              <li>
                <span aria-hidden="true">⚡</span> 20초 이내 완료되는 신속한
                Fact Check (이미지, 텍스트)
              </li>
              <li>
                <span aria-hidden="true">🛡️</span> 오버레이 경고로 실시간 허위
                정보 감지
              </li>
              <li>
                <span aria-hidden="true">🔗</span> 근거가 담긴 공유 링크 자동
                생성
              </li>
            </ul>
            <div className="landing__cta-group">
              <a
                href="#install-guide"
                className="landing__cta landing__cta--primary"
              >
                익스텐션 설치하기
              </a>
              <a
                href="#hacktruth-flow"
                className="landing__cta landing__cta--ghost"
              >
                HackTruth 동작 보기
              </a>
            </div>
          </div>

          <div className="landing__hero-media" aria-hidden="true">
            <div className="hero-card hero-card--modal">
              <span className="hero-card__label">Fact Check Modal</span>
              <div className="hero-card__result">
                <strong>거짓된 정보 가능성</strong>
                <p>
                  요청하신 정보에 거짓된 정보가 포함되어있을 확률이 높습니다.
                </p>
              </div>
              <div className="hero-card__reference">
                <span>근거</span>
                <p>
                  팩트 체크 모델의 분석 결과 및 러페런스 링크를 확인할 수
                  있습니다.
                </p>
              </div>
              <button type="button" className="hero-card__action">
                결과 공유하기
              </button>
            </div>

            <div className="hero-card hero-card--overlay">
              <span className="hero-card__badge">진행 중</span>
              <p>유튜브 영상 Fact Check 처리 중...</p>
              <div className="hero-card__progress">
                <span style={{ width: "68%" }} />
              </div>
            </div>

            <div className="hero-card hero-card--loading">
              <div className="hero-card__spinner" />
              <p>백그라운드 텍스트 감지 중...</p>
            </div>
          </div>
        </div>

        <div className="landing__hero-stats">
          <div className="landing__stat-card">
            <strong>90%+</strong>
            <span>텍스트/이미지 팩트 체크 성공률</span>
          </div>
          <div className="landing__stat-card">
            <strong>10초 내외</strong>
            <span>AI 생성형 이미지 판별 속도</span>
          </div>
          <div className="landing__stat-card">
            <strong>24시간/7일</strong>
            <span>백그라운드 감지 가능</span>
          </div>
        </div>
      </section>

      <section
        ref={featureRef}
        className={`landing__section landing__section--feature reveal-section ${
          featureVisible ? "reveal-section--visible" : ""
        }`}
      >
        <div className="landing__section-header">
          <h2>팩트체크 워크플로를 위한 핵심 경험</h2>
          <p>
            HackTruth는 단순히 결과를 보여주는 것을 넘어, Fact Check가 진행되는
            순간의 맥락과 이유를 모두 안내합니다. 각 구성요소가 하나의 경험으로
            연결됩니다.
          </p>
        </div>
        <div className="landing__feature-grid">
          <article className="landing__feature-card">
            <div className="landing__feature-icon" aria-hidden="true">
              🎯
            </div>
            <h3>결과 모달</h3>
            <p>
              사실 여부, 판단 근거, 참조 링크를 하나의 뷰에 압축했습니다. 누구나
              이해하기 쉽도록 구조화된 카드와 시각적 배지로 결론을 강조합니다.
            </p>
          </article>
          <article className="landing__feature-card">
            <div className="landing__feature-icon" aria-hidden="true">
              👁️
            </div>
            <h3>실시간 오버레이</h3>
            <p>
              우측 하단 오버레이가 누구보다 먼저 경고합니다. 백그라운드 감지 중
              감지된 허위 정보는 즉시 안내하고, 진행률과 상태를 동시에
              표시합니다.
            </p>
          </article>
          <article className="landing__feature-card">
            <div className="landing__feature-icon" aria-hidden="true">
              ⏱️
            </div>
            <h3>로딩 피드백</h3>
            <p>
              작은 로딩 애니메이션으로 사용자는 언제든 HackTruth가 일하고 있다는
              사실을 알 수 있습니다. 처리 단계와 남은 흐름을 직관적으로
              이해시킵니다.
            </p>
          </article>
          <article className="landing__feature-card">
            <div className="landing__feature-icon" aria-hidden="true">
              🔁
            </div>
            <h3>공유 링크</h3>
            <p>
              클릭 한 번으로 결과와 근거가 담긴 링크가 발급됩니다. 조사 맥락을
              그대로 전파하며, 협업과 인용에 필요한 정보를 손쉽게 전달할 수
              있습니다.
            </p>
          </article>
        </div>
      </section>

      <section
        id="hacktruth-flow"
        ref={experienceRef}
        className={`landing__section landing__section--muted landing__section--split reveal-section ${
          experienceVisible ? "reveal-section--visible" : ""
        }`}
      >
        <div className="landing__section-header">
          <h2>매체별 사용자 플로우</h2>
          <p>
            HackTruth는 영상, 이미지, 텍스트 등 서로 다른 콘텐츠 유형에 맞춰
            자연스럽게 동작합니다. 전 과정은 오버레이와 모달로 연결되어 사용자가
            길을 잃지 않도록 돕습니다.
          </p>
        </div>
        <div className="landing__flow-grid">
          <article className="landing__flow-card">
            <span className="landing__flow-badge">영상</span>
            <h3>영상 콘텐츠 Fact Check</h3>
            <ul>
              <li>유튜브 영상 우측 하단에 Fact Check 버튼 노출</li>
              <li>버튼 클릭 시 오버레이가 요청 처리 중임을 안내</li>
              <li>
                검증 완료 후 모달에서 AI 포함 여부, 허위 정보, 레퍼런스 제공
              </li>
            </ul>
          </article>

          <article className="landing__flow-card">
            <span className="landing__flow-badge">이미지</span>
            <h3>이미지 진위 확인</h3>
            <ul>
              <li>이미지 우클릭 → Fact Check 선택</li>
              <li>오버레이가 처리 진행 상황을 표시</li>
              <li>결과 모달에서 판정 점수, 판단 이유, 참고 자료 확인</li>
            </ul>
          </article>

          <article className="landing__flow-card">
            <span className="landing__flow-badge">텍스트</span>
            <h3>드래그한 텍스트도 즉시 검증</h3>
            <ul>
              <li>텍스트 선택 후 팩트체크 옵션 클릭</li>
              <li>우측 하단 오버레이로 진행 상태 안내</li>
              <li>
                결과 모달에서 사실 확률과 설명 제공, 공유하기로 웹페이지 연결
              </li>
            </ul>
          </article>

          <article className="landing__flow-card">
            <span className="landing__flow-badge">백그라운드 감지</span>
            <h3>방문한 페이지에서 거짓 정보 가능성 감지</h3>
            <ul>
              <li>방문한 페이지에서 텍스트 자동 분석</li>
              <li>거짓 정보 가능성이 있으면 오버레이 경고 노출</li>
            </ul>
          </article>
        </div>
      </section>

      <section
        id="install-guide"
        ref={installRef}
        className={`landing__section landing__section--install reveal-section ${
          installVisible ? "reveal-section--visible" : ""
        }`}
      >
        <div className="landing__section-header">
          <h2>🚀 설치 방법</h2>
          <p>
            HackTruth는 아직 Chrome 웹 스토어 심사 중입니다. 아래 안내를 따라
            로컬에서 확장 프로그램을 불러오고 바로 사용해보세요.
          </p>
        </div>

        <ol className="landing__install-steps">
          <li>
            <h3>프로젝트 다운로드</h3>
            <p>
              <a
                className="landing__link"
                href="https://github.com/2025-IA-x-AI-Hackathon/Hack-truth/archive/refs/heads/main.zip"
                target="_blank"
                rel="noreferrer"
              >
                HackTruth 다운로드
              </a>
              이 버튼을 눌러 ZIP 파일을 내려받고 압축을 풀어주세요.
            </p>
          </li>
          <li>
            <h3>Chrome 브라우저에서 개발자 모드 열기</h3>
            <p>
              주소창에 <code>chrome://extensions/</code> 를 입력하거나 메뉴 &gt;
              도구 더보기 &gt; 확장 프로그램으로 이동합니다.
            </p>
          </li>
          <li>
            <h3>개발자 모드 활성화</h3>
            <p>
              확장 프로그램 페이지 우측 상단에서 &ldquo;개발자 모드&rdquo;
              토글을 켭니다.
            </p>
            <img
              src="/public/extension-developer-mode.png"
              alt="Chrome 확장 프로그램 개발자 모드 화면"
            />
          </li>
          <li>
            <h3>압축 해제한 확장 프로그램 로드</h3>
            <p>
              &ldquo;압축해제된 확장 프로그램을 로드합니다&rdquo; 버튼을 눌러
              압축 해제한 <code>HackTruth/extension</code> 폴더를 선택합니다.
            </p>
          </li>
          <li>
            <h3>설치 확인 및 고정</h3>
            <p>
              확장 프로그램 목록에 &ldquo;Fact Check&rdquo;가 보이면 설치가
              완료되었습니다. 필요하다면 퍼즐 아이콘에서 핀을 눌러 툴바에
              고정하세요.
            </p>
          </li>
        </ol>
      </section>

      <section
        ref={ctaRef}
        className={`landing__section landing__section--cta reveal-section ${
          ctaVisible ? "reveal-section--visible" : ""
        }`}
      >
        <div className="landing__cta-panel">
          <h2>HackTruth와 함께 진실을 더 빠르게</h2>
          <p>
            팩트체크는 복잡할 필요가 없습니다. 브라우저에 HackTruth를 설치하고,
            필요한 순간 버튼을 눌러주세요. 나머지는 우리가 책임집니다.
          </p>
          <div className="landing__cta-group">
            <a
              href="#install-guide"
              className="landing__cta landing__cta--primary"
            >
              익스텐션 설치하기
            </a>
            <a
              href="#hacktruth-flow"
              className="landing__cta landing__cta--ghost"
            >
              기능 다시 보기
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
