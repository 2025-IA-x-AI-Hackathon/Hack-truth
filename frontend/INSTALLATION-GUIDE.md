# 📦 크롬 확장 프로그램 설치 가이드

이 문서는 **Fact Check** 확장 프로그램을 Chrome 브라우저에 설치하는 상세한 단계별 가이드입니다.

## 🎯 시작하기 전에

### 필요한 것

- ✅ Google Chrome 브라우저 (최신 버전 권장)
- ✅ 이 프로젝트 폴더의 모든 파일
- ✅ 아이콘 파일 (icons 폴더에 4개의 PNG 파일)

### 아이콘 파일 준비

아이콘이 없다면 먼저 준비해야 합니다:

**방법 1: 간단한 생성기 사용 (추천)**

1. 프로젝트 폴더의 `create-test-icons.html` 파일을 더블클릭하여 브라우저에서 엽니다
2. "모든 아이콘 생성" 버튼을 클릭합니다
3. 각 아이콘의 "다운로드" 버튼을 클릭하여 저장합니다
4. 다운로드한 파일을 `icons/` 폴더로 이동합니다

**방법 2: 온라인 도구 사용**

- `icons/README.md` 파일을 참조하여 직접 디자인

---

## 📥 Step-by-Step 설치 가이드

### Step 1: Chrome 확장 프로그램 페이지 열기

**방법 A: 주소창 사용**

```
chrome://extensions/
```

주소창에 위 주소를 입력하고 Enter를 누릅니다.

**방법 B: 메뉴 사용**

1. Chrome 브라우저 우측 상단의 **점 3개 메뉴(⋮)** 클릭
2. **도구 더보기** → **확장 프로그램** 선택

![Chrome 메뉴](https://developer.chrome.com/static/docs/extensions/mv3/getstarted/development-basics/image/chrome-menu-extensions-b92e0c1e0f5b4_1920.png)

---

### Step 2: 개발자 모드 활성화

1. 확장 프로그램 페이지의 **우측 상단**을 확인합니다
2. **"개발자 모드"** 토글 스위치를 찾습니다
3. 토글을 **ON(파란색)**으로 전환합니다

![개발자 모드 활성화](https://developer.chrome.com/static/docs/extensions/mv3/getstarted/development-basics/image/extensions-page-e0d64d89a6acf_1920.png)

> 💡 **참고**: 개발자 모드를 활성화하면 추가 옵션들이 나타납니다.

---

### Step 3: 확장 프로그램 로드

1. 새로 나타난 버튼 중 **"압축해제된 확장 프로그램을 로드합니다"** 버튼을 클릭합니다

   ![압축해제된 확장 프로그램 로드 버튼](https://developer.chrome.com/static/docs/extensions/mv3/getstarted/development-basics/image/load-unpacked-button-be5c6815c9fd8_1920.png)

2. 파일 탐색기 창이 열립니다

3. **이 프로젝트 폴더** (`extension-fact-check-1`)를 찾아서 선택합니다

4. **"폴더 선택"** 또는 **"열기"** 버튼을 클릭합니다

---

### Step 4: 설치 확인

확장 프로그램이 성공적으로 로드되면:

✅ **확장 프로그램 목록에 "Fact Check" 표시**

- 이름: Fact Check
- 버전: 1.0.0
- 상태: 켜짐

✅ **아이콘이 정상적으로 표시**

- 보라색 그라데이션 배경의 돋보기 아이콘

⚠️ **오류가 표시되는 경우**:

**오류 예시 1**: "Manifest file is missing or unreadable"

- **해결**: `manifest.json` 파일이 프로젝트 루트에 있는지 확인

**오류 예시 2**: "Could not load icon 'icons/icon16.png'"

- **해결**: `icons/` 폴더에 모든 아이콘 파일이 있는지 확인
- 파일명이 정확한지 확인: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`

**오류 예시 3**: JavaScript 에러

- **해결**: 오류 메시지를 읽고 해당 파일의 문법 오류 수정
- "세부정보" 버튼을 클릭하여 자세한 오류 내용 확인

---

### Step 5: 확장 프로그램 고정 (선택사항)

툴바에 아이콘을 항상 표시하려면:

1. Chrome 주소창 옆의 **퍼즐 조각 아이콘(🧩)** 클릭
2. 확장 프로그램 목록에서 **"Fact Check"** 찾기
3. 옆의 **핀 아이콘(📌)** 클릭
4. 아이콘이 툴바에 고정됩니다

![확장 프로그램 고정](https://developer.chrome.com/static/docs/extensions/mv3/user_interface/image/pin-extension-chrome-too-57e7c0d5ef2e0_1440.png)

---

## ✅ 테스트해보기

### 1. 텍스트 팩트 체크 테스트

1. 아무 웹페이지를 엽니다 (예: news.google.com)
2. 텍스트 일부를 **드래그**하여 선택합니다
3. 선택한 텍스트에서 **우클릭**합니다
4. 컨텍스트 메뉴에서 **"Fact Check (텍스트)"** 확인
5. 메뉴를 클릭하여 팩트 체크 팝업이 나타나는지 확인

### 2. 이미지 팩트 체크 테스트

1. 이미지가 있는 웹페이지를 엽니다
2. 이미지에서 **우클릭**합니다
3. 컨텍스트 메뉴에서 **"Fact Check (이미지)"** 확인
4. 메뉴를 클릭하여 팩트 체크 팝업이 나타나는지 확인

### 3. 설정 팝업 테스트

1. 툴바의 **Fact Check 아이콘**을 클릭합니다
2. 팝업 창이 열리는지 확인합니다
3. **"팩트 체크 활성화"** 토글을 OFF로 변경합니다
4. 텍스트를 우클릭하면 Fact Check 메뉴가 작동하지 않는지 확인
5. 토글을 다시 ON으로 변경합니다

---

## 🔧 문제 해결

### 문제: 우클릭 메뉴에 "Fact Check"가 나타나지 않음

**해결 방법:**

1. 확장 프로그램이 활성화되어 있는지 확인
2. 웹페이지를 **새로고침** (F5 또는 Cmd/Ctrl + R)
3. `chrome://extensions/`에서 확장 프로그램 **새로고침 버튼(🔄)** 클릭
4. 팝업에서 "팩트 체크 활성화"가 ON인지 확인

### 문제: 팝업이 제대로 표시되지 않음

**해결 방법:**

1. F12를 눌러 개발자 도구 열기
2. Console 탭에서 오류 메시지 확인
3. `content.css` 파일이 제대로 로드되었는지 확인
4. 페이지 새로고침 후 다시 시도

### 문제: 확장 프로그램 아이콘을 클릭해도 팝업이 안 열림

**해결 방법:**

1. `popup.html` 파일이 존재하는지 확인
2. `chrome://extensions/`에서 오류 메시지 확인
3. 확장 프로그램 **재로드** 시도

---

## 🔄 코드 수정 후 적용 방법

코드를 수정한 후에는 반드시 확장 프로그램을 새로고침해야 합니다:

### 방법 1: 확장 프로그램 페이지에서 새로고침

1. `chrome://extensions/` 페이지로 이동
2. "Fact Check" 카드 찾기
3. **새로고침 버튼(🔄)** 클릭

### 방법 2: 단축키 사용 (빠름)

1. `chrome://extensions/` 페이지에서
2. **Ctrl+R** (Windows) 또는 **Cmd+R** (Mac)
3. 모든 확장 프로그램이 새로고침됩니다

### 주의사항

- **Content Script 수정**: 웹페이지도 새로고침 필요
- **Background Script 수정**: 확장 프로그램만 새로고침
- **Popup 수정**: 확장 프로그램 새로고침 후 팝업 다시 열기

---

## 🐛 디버깅 방법

### Background Script (Service Worker) 디버깅

1. `chrome://extensions/` 페이지로 이동
2. "Fact Check" 카드의 **"Service Worker"** 링크 클릭
3. DevTools가 열리면 Console에서 로그 확인
4. `background.js`에 `console.log()` 추가하여 디버깅

### Content Script 디버깅

1. 웹페이지에서 **F12**를 눌러 DevTools 열기
2. **Console** 탭에서 로그 확인
3. **Sources** 탭 → **Content scripts** → `content.js` 선택
4. 브레이크포인트 설정하여 디버깅

### Popup 디버깅

1. 팝업을 연 상태에서
2. 팝업 내부에서 **우클릭** → **"검사"** 선택
3. DevTools가 팝업용으로 열립니다
4. Console과 Elements 탭에서 디버깅

---

## 📚 추가 자료

- [Chrome Extensions 공식 문서](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 가이드](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [확장 프로그램 디버깅](https://developer.chrome.com/docs/extensions/mv3/tut_debugging/)

---

## 🎉 설치 완료!

이제 **Fact Check** 확장 프로그램을 사용할 준비가 되었습니다!

웹서핑하면서 의심스러운 정보를 발견하면 언제든지 우클릭하여 팩트 체크를 해보세요.

**즐거운 팩트 체킹 되세요! 🔍✨**
