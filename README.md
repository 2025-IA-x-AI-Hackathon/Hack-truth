# HackTruth

사실과 거짓을 구별하기 어려워지는 세상에서 저희 팀(팀명 : 진실의 나의 빛)은 **진실을 구별할 수 있는 힘**이 되고자 해커톤 프로젝트를 기획했습니다.
사실검증이 되지 않고 무분별하게 **(1) 커뮤니티 글, 댓글, 유투브 영상 및 쇼츠로 가짜뉴스가 퍼지는 것**, **(2) 더이상 현실과 구별이 어려워진 AI 생성형 이미지/영상**을 쉽고 정확하게 구분할 수 있는 세상을 바라며 프로젝트를 완성했습니다.

## 목차
- [주요 기능](#주요-기능)
- [구성 요소](#구성-요소)
- [프로젝트 구조](#프로젝트-구조)
- [빠른 시작](#빠른-시작)
- [백엔드 설정](#백엔드-설정)
- [프런트엔드 설정](#프런트엔드-설정)
- [Chrome 확장 프로그램](#chrome-확장-프로그램)
- [API 개요](#api-개요)
- [개발 메모](#개발-메모)
- [추가 문서](#추가-문서)

## 주요 기능
- 텍스트 사실 검증: Gemini 모델이 근거 URL과 함께 정확도·판단 사유를 한국어로 반환합니다.
- 이미지 진위 판별: Gemini 모델이 AI 생성 이미지 인지 딥페이크 가능성을 계산합니다.
- 영상 판별: YouTube 영상을 다운로드해 FFT/Optical Flow 기반 지표로 생성 영상 가능성을 추정합니다.
- 결과 저장 및 공유: 검증 결과를 PostgreSQL에 보관하고 고유 `record_id`를 통해 공유 URL을 생성합니다.
- Chrome 확장 프로그램(주요 클라이언트): 우클릭 메뉴와 오버레이 UI로 텍스트·이미지·영상 검증을 실행하고, 공유 링크를 바로 발급합니다.
- React 공유 뷰어: `/share?id=<record_id>` 형태의 링크를 열어 검증 결과, 근거, 원문 텍스트를 확인할 수 있는 보조 웹 페이지입니다.

## 결과 통계(TODO)


## 구성 요소
- `backend/`: FastAPI 서비스. Gemini API와 Hugging Face 모델, Postgres를 사용하여 검증 로직을 제공합니다.
- `frontend/`: Vite + React 애플리케이션. 공유 링크 진입 시 검증 결과를 정규화해 렌더링하는 보조 뷰어입니다.
- `extension/`: Manifest V3 Chrome 확장. 실제 사용자 클라이언트로, 컨텍스트 메뉴·오버레이 UI·백그라운드 감지를 통해 Fact Check를 실행합니다.
- 루트 문서: 커밋 컨벤션, 요구 패키지 등의 참고 자료.

## 프로젝트 구조
```
Hack-truth/
├── backend/                # FastAPI 애플리케이션
├── frontend/               # 공유 결과 뷰어 (React, Vite)
├── extension/              # Chrome 확장 프로그램
├── README.md               # 이 문서
├── commit_convetion.md     # 팀 커밋 규칙
```

## 빠른 시작
1. **필수 도구 설치**
   - Python 3.10 이상 (가상환경 권장)
   - Node.js 18 이상 / npm
   - PostgreSQL 14 이상 (또는 호환 클라우드 인스턴스)
   - (선택) Docker: `docker run --name hacktruth-postgres -e POSTGRES_PASSWORD=hacktruth -p 5432:5432 -d postgres:14`
2. **저장소 클론 후 의존성 설치**
   ```bash
   # 백엔드
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt

   # 프런트엔드
   cd ../frontend
   npm install
   ```
3. **환경 변수 준비**
   - 백엔드: Gemini API 키, Postgres 연결 정보 등 (아래 참조)
   - 프런트엔드: `VITE_API_BASE_URL`
   - 확장 프로그램: 팝업에서 API Base URL 설정
4. **서비스 구동**
   ```bash
   # 백엔드 (새 터미널)
   cd backend
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

   # 프런트엔드 (다른 터미널)
   cd frontend
   npm run dev
   ```
5. **확장 프로그램 로드 (주요 인터페이스)**
   - Chrome → `chrome://extensions` → 개발자 모드 → “압축해제된 확장 프로그램 로드” → `extension/` 폴더 선택.
   - 팝업에서 백엔드 API Base URL을 등록하면 바로 검증 기능을 사용할 수 있습니다.

## 백엔드 설정
- 실행: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- 주요 의존성: FastAPI, google-genai, transformers, torch, asyncpg, yt-dlp, OpenCV.
- 데이터베이스: PostgreSQL의 `verification_records` 테이블을 자동 생성합니다.
- 모델 캐시: Hugging Face 모델은 최초 실행 시 로컬 캐시(`~/.cache/huggingface/`)를 사용합니다.

### 환경 변수
| 키 | 설명 | 기본값 |
| --- | --- | --- |
| `GEMINI_API_KEYS` 또는 `GEMINI_API_KEY` | Google Gemini API 키(복수 개 가능, 라운드 로빈) | 필수 |
| `GEMINI_MODEL` | 텍스트 검증 기본 모델 | `gemini-flash-latest` |
| `GEMINI_ENABLE_GOOGLE_SEARCH` | 검색 도구 사용 여부 (`true`/`false`) | `true` |
| `GEMINI_TEMPERATURE` | 텍스트 검증 온도 | `0.2` |
| `GEMINI_VERIFICATION_ATTEMPTS` | 실패 시 재시도 횟수 | `2` |
| `DATABASE_URL` | Postgres DSN (`postgresql://user:pass@host:port/db`) | 직접 설정하거나 아래 개별 변수 사용 |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | 개별 DB 설정 | `PORT=5432` |
| `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX` | asyncpg 커넥션 풀 크기 | `1`, `5` |
| `LOG_LEVEL` | 로깅 레벨 | `DEBUG` |
| `GEMINI_IMAGE_MODEL`, `GEMINI_IMAGE_TEMPERATURE` | 이미지 판별용 모델/온도 | 기본 텍스트 모델, `0.0` |

`.env` 예시 (`backend/.env`):
```env
DATABASE_URL=postgresql://hacktruth:hacktruth@localhost:5432/hacktruth
GEMINI_API_KEYS=your-key-1,your-key-2
LOG_LEVEL=INFO
```

## 프런트엔드 설정 (공유 뷰어 및 소개 페이지)
- 기술 스택: React 18, Vite 5, React Router 6.
- 역할: `/share?id=<record_id>` 링크 진입 시 백엔드에서 공유 데이터를 불러와 정규화합니다. 확장 프로그램이 발급한 공유 링크를 열었을 때 사용자에게 결과를 보여주는 용도입니다.
- `.env.local` 예시 (`frontend/.env.local`):
  ```env
  VITE_API_BASE_URL=http://localhost:8000
  ```
- 개발 서버: `npm run dev` → 기본 포트 `5173`.
- 빌드: `npm run build` → 정적 파일은 `dist/`에 생성됩니다.

## Chrome 확장 프로그램
- Manifest V3 기반 서비스 워커(`background.js`)와 컨텐츠 스크립트(`content.js`)로 동작합니다.
- 주요 기능
  - 텍스트/이미지 우클릭 컨텍스트 메뉴 팩트체크
  - 유튜브 등 영상 페이지용 오버레이 UI
  - 백그라운드 감지 및 경고 배너
  - API Base URL, 기능 토글을 저장하는 팝업 UI

## API 개요
기본 URL: `http://<host>:8000`

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET /health` | 서비스 상태 확인 |
| `POST /verify/text` | 본문 텍스트 팩트체크 (`{ "text": "..." }`) |
| `GET /verify/text/{record_id}` | 저장된 텍스트 검증 결과 조회 |
| `POST /verify/image` | HuggingFace이미지 딥페이크 판별 (`{ "image_url": "https://..." }`) |
| `POST /verify/image-gemini` | Gemini 기반 이미지 판별 |
| `POST /verify/video` | YouTube URL 기반 영상 판별 (`{ "url": "https://youtube.com/..."} ) |

예시 요청:
```bash
curl -X POST http://localhost:8000/verify/text \
  -H "Content-Type: application/json" \
  -d '{"text": "2024년에 화성에서 생명체가 발견되었다."}'
```

## 개발 메모
- 모델 의존성(특히 `torch`, `opencv`, `mediapipe`) 설치 시간과 디스크 용량을 고려하세요.
- 영상 판별은 `yt-dlp`로 파일을 내려받으므로 디렉터리 쓰기 권한이 필요합니다.
- Gemini API 호출 실패 시 재시도하며, 여러 API 키를 라운드 로빈으로 사용합니다.
- 프런트 공유 페이지는 브라우저 콘솔에서 응답 로그를 확인할 수 있도록 설계되어 트러블슈팅이 용이합니다.
- 확장 프로그램은 `sessionStorage`에 마지막 공유 링크를 저장하여 내비게이션을 돕습니다.

## 추가 문서
- `backend/README.md`: 백엔드 실행 요약
- `extension/README.md`: 확장 프로그램 기능/설치 가이드
- `commit_convetion.md`: 팀 커밋 메시지 규칙
