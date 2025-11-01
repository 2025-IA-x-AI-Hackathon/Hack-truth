# 🔍 Fact Check - Chrome Extension

텍스트와 이미지의 팩트 체크를 도와주는 크롬 확장 프로그램입니다.

> ⚠️ **주의**: 이것은 기능 테스트 버전입니다. 실제 AI 분석 기능은 향후 API 연동 후 구현됩니다.

## 📋 목차

- [주요 기능](#주요-기능)
- [설치 방법](#설치-방법)
- [사용 방법](#사용-방법)
- [프로젝트 구조](#프로젝트-구조)
- [개발 가이드](#개발-가이드)
- [참고 자료](#참고-자료)

## ✨ 주요 기능

### 1. 텍스트 팩트 체크

- 웹페이지에서 텍스트를 드래그하고 우클릭
- "Fact Check (텍스트)" 메뉴 선택
- 사실 가능성과 참고 레퍼런스 확인

### 2. 이미지 검증

- 이미지에서 우클릭
- "Fact Check (이미지)" 메뉴 선택
- AI 생성 여부 분석 결과 확인

### 3. 확장 프로그램 설정

- 툴바 아이콘 클릭
- 팩트 체크 기능 활성화/비활성화 토글

## 🚀 설치 방법

### Step 1: 프로젝트 준비

1. 이 프로젝트 폴더를 준비합니다.
2. `icons` 폴더에 필요한 아이콘 파일을 추가합니다.

   - icon16.png (16x16px)
   - icon32.png (32x32px)
   - icon48.png (48x48px)
   - icon128.png (128x128px)

   > 아이콘 생성 방법은 [`icons/README.md`](./icons/README.md)를 참조하세요.

### Step 2: Chrome에 확장 프로그램 로드

1. **Chrome 브라우저를 엽니다.**

2. **확장 프로그램 관리 페이지로 이동:**

   - 주소창에 `chrome://extensions/` 입력, 또는
   - 메뉴 (⋮) → 도구 더보기 → 확장 프로그램

3. **개발자 모드 활성화:**

   - 우측 상단의 "개발자 모드" 토글을 ON으로 전환

   ![개발자 모드](https://developer.chrome.com/static/docs/extensions/mv3/getstarted/development-basics/image/extensions-page-e0d64d89a6acf_1920.png)

4. **압축해제된 확장 프로그램을 로드:**

   - "압축해제된 확장 프로그램을 로드합니다" 버튼 클릭
   - 이 프로젝트 폴더 (`extension-fact-check-1`) 선택

5. **확장 프로그램 확인:**

   - 목록에 "Fact Check" 확장 프로그램이 나타나야 합니다
   - 오류가 있다면 오류 메시지를 확인하고 수정합니다

6. **툴바에 고정 (선택사항):**
   - 주소창 옆의 퍼즐 아이콘 클릭
   - "Fact Check" 옆의 핀 아이콘 클릭하여 툴바에 고정

## 📖 사용 방법

### 텍스트 팩트 체크

1. 웹페이지에서 팩트 체크하고 싶은 텍스트를 드래그합니다.
2. 선택한 텍스트에서 **우클릭**합니다.
3. 컨텍스트 메뉴에서 **"Fact Check (텍스트)"**를 선택합니다.
4. 팝업 창에서 결과를 확인합니다:
   - 사실 가능성 퍼센테ージ
   - 참고할 수 있는 레퍼런스 링크

### 이미지 팩트 체크

1. 웹페이지에서 검증하고 싶은 이미지를 찾습니다.
2. 이미지에서 **우클릭**합니다.
3. 컨텍스트 메뉴에서 **"Fact Check (이미지)"**를 선택합니다.
4. 팝업 창에서 결과를 확인합니다:
   - AI 생성 여부
   - 신뢰도 퍼센테ージ
   - 분석 세부사항

### 설정 관리

1. Chrome 툴바에서 **Fact Check 아이콘**을 클릭합니다.
2. 팝업 창에서:
   - 확장 프로그램 소개 확인
   - "팩트 체크 활성화" 토글로 기능 ON/OFF

## 📁 프로젝트 구조

```
extension-fact-check-1/
├── manifest.json          # 확장 프로그램 설정 파일
├── background.js          # 백그라운드 서비스 워커
├── content.js             # 웹페이지에 주입되는 스크립트
├── content.css            # 팩트 체크 팝업 스타일
├── popup.html             # 확장 프로그램 팝업 HTML
├── popup.css              # 확장 프로그램 팝업 스타일
├── popup.js               # 확장 프로그램 팝업 로직
├── icons/                 # 아이콘 파일들
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── README.md         # 아이콘 생성 가이드
└── README.md             # 이 파일
```

## 🛠 개발 가이드

### 파일 역할 설명

#### `manifest.json`

- 확장 프로그램의 메타데이터와 권한을 정의
- Manifest V3 사용 (최신 버전)
- 필수 권한: `contextMenus`, `storage`, `activeTab`

#### `background.js` (Service Worker)

- 컨텍스트 메뉴 생성 및 관리
- 우클릭 이벤트 처리
- 확장 프로그램 설정 저장/로드

#### `content.js` + `content.css`

- 웹페이지에 주입되는 스크립트
- 팩트 체크 결과를 보여주는 팝업 생성
- 텍스트/이미지 분석 로직 (테스트 버전)

#### `popup.html` + `popup.css` + `popup.js`

- 툴바 아이콘 클릭 시 나타나는 팝업
- 확장 프로그램 소개 및 설정 UI

### 코드 수정 후 적용 방법

1. 코드를 수정합니다.
2. `chrome://extensions/` 페이지로 이동합니다.
3. "Fact Check" 확장 프로그램 카드에서 **새로고침 버튼** (🔄)을 클릭합니다.
4. 웹페이지를 새로고침하여 변경사항을 확인합니다.

### 디버깅 방법

#### Background Script 디버깅

1. `chrome://extensions/` 페이지에서
2. "Fact Check" 카드의 "Service Worker" 링크 클릭
3. DevTools에서 로그 확인

#### Content Script 디버깅

1. 웹페이지에서 F12를 눌러 DevTools 열기
2. Console 탭에서 로그 확인
3. Sources 탭에서 `content.js` 찾아 breakpoint 설정 가능

#### Popup 디버깅

1. 팝업을 연 상태에서 팝업 내부에서 우클릭
2. "검사" 선택하여 DevTools 열기

### 향후 개발 계획

현재는 테스트 버전으로 간단한 로직만 구현되어 있습니다. 실제 서비스를 위해서는:

1. **AI API 연동**

   - OpenAI API, Google Cloud Vision API 등
   - 텍스트: GPT를 이용한 팩트 체크
   - 이미지: AI 생성 여부 감지 모델 연동

2. **데이터베이스 연동**

   - 팩트 체크 히스토리 저장
   - 사용자 피드백 수집

3. **성능 최적화**

   - 캐싱 메커니즘
   - 비동기 처리 개선

4. **UI/UX 개선**
   - 로딩 애니메이션
   - 더 상세한 분석 결과
   - 다크 모드 지원

## 🔗 참고 자료

### Chrome Extension 개발

- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Service Workers](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Context Menus API](https://developer.chrome.com/docs/extensions/reference/contextMenus/)

### 코드 품질

- [Frontend Fundamentals - Code Quality](https://frontend-fundamentals.com/code-quality/)

### 팩트 체크 리소스

- [FactCheck.org](https://www.factcheck.org)
- [Snopes](https://www.snopes.com)
- [Google Fact Check Tools](https://toolbox.google.com/factcheck/explorer)

### AI 이미지 감지

- [AI or Not - Image Detector](https://www.aiornot.com)
- [Hugging Face - AI Image Detection Models](https://huggingface.co/models?pipeline_tag=image-classification)

## 📝 라이선스

이 프로젝트는 교육 및 테스트 목적으로 제작되었습니다.

## 🤝 기여

버그 리포트나 기능 제안은 언제든 환영합니다!

---

**Made with ❤️ for better internet fact-checking**
