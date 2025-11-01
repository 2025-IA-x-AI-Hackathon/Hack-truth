# 아이콘 파일 생성 가이드

크롬 확장 프로그램을 위한 아이콘 파일이 필요합니다.

## 필요한 아이콘 크기

- **icon16.png** (16x16 픽셀)
- **icon32.png** (32x32 픽셀)
- **icon48.png** (48x48 픽셀)
- **icon128.png** (128x128 픽셀)

## 아이콘 생성 방법

### 방법 1: 온라인 도구 사용 (가장 간단)

1. **Canva** (https://www.canva.com) 접속

   - 사용자 정의 크기로 128x128 픽셀 디자인 생성
   - 🔍 돋보기 아이콘 또는 "Fact Check" 텍스트 추가
   - 보라색 그라데이션 배경 (#667eea ~ #764ba2)
   - PNG로 다운로드
   - 온라인 이미지 리사이저로 16, 32, 48 픽셀 버전 생성

2. **Figma** (https://www.figma.com) - 무료
   - 128x128 프레임 생성
   - 돋보기 아이콘 디자인
   - Export 기능으로 각 크기별 PNG 생성

### 방법 2: 무료 아이콘 사이트 이용

1. **Flaticon** (https://www.flaticon.com) 방문
2. "magnifying glass" 또는 "fact check" 검색
3. 마음에 드는 아이콘 선택
4. PNG 형식으로 다운로드 (512px 권장)
5. **Bulk Resize Photos** (https://bulkresizephotos.com) 에서 일괄 리사이징

### 방법 3: AI 이미지 생성

**ChatGPT** 또는 **DALL-E** 사용:

```
프롬프트: "Create a simple, modern icon for a fact-checking Chrome extension.
Purple gradient background (#667eea to #764ba2), magnifying glass symbol in white,
flat design, 128x128 pixels, transparent edges"
```

### 방법 4: 간단한 텍스트 아이콘 (임시용)

임시로 테스트하려면 간단한 색상 배경에 텍스트만 있는 아이콘도 가능합니다:

- 온라인 이미지 편집기에서 보라색 사각형 생성
- "FC" 또는 "✓" 텍스트 추가
- 각 크기별로 저장

## 빠른 테스트용 아이콘

테스트 목적으로 아래 사이트에서 무료 아이콘을 다운로드할 수 있습니다:

- https://www.flaticon.com/free-icon/check_5290058
- https://www.flaticon.com/free-icon/magnifier_149852

## 주의사항

- 모든 아이콘은 **PNG 형식**이어야 합니다
- 배경은 투명 또는 단색으로 처리
- 너무 복잡한 디자인은 작은 크기(16px)에서 잘 보이지 않음
- 크롬 웹 스토어 정책을 준수하는 디자인 사용
