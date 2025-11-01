// Content Script - 웹페이지에 주입되는 스크립트
// Reference: https://developer.chrome.com/docs/extensions/mv3/content_scripts/

// 페이지 로드 시 YouTube/Instagram 감지 버튼 표시
const initializePageSpecificButtons = () => {
  const url = window.location.href;

  if (isYouTubePage(url)) {
    showYouTubeButton();
  } else if (isInstagramPage(url)) {
    showInstagramButton();
  }
};

// YouTube 페이지인지 확인
const isYouTubePage = (url) => {
  return url.includes("youtube.com/watch") || url.includes("youtu.be/");
};

// Instagram 페이지인지 확인
const isInstagramPage = (url) => {
  return (
    url.includes("instagram.com/p/") || url.includes("instagram.com/reel/")
  );
};

// YouTube 버튼 표시
const showYouTubeButton = () => {
  removeExistingButton();
  const button = createPageButton("현재 유투브 영상 거짓 판별하기", "youtube");
  document.body.appendChild(button);
};

// Instagram 버튼 표시
const showInstagramButton = () => {
  removeExistingButton();
  const button = createPageButton(
    "현재 인스타그램 포스트 거짓 판별하기",
    "instagram"
  );
  document.body.appendChild(button);
};

// 페이지 버튼 생성
const createPageButton = (text, platform) => {
  const button = document.createElement("div");
  button.id = "fact-check-page-button";
  button.className = `fact-check-page-button ${platform}`;
  button.innerHTML = `<span>${text}</span>`;

  button.addEventListener("click", () => {
    handlePageButtonClick(platform);
  });

  return button;
};

// 버튼 클릭 처리
const handlePageButtonClick = (platform) => {
  // 버튼 숨기기
  hidePageButton();

  // URL 오버레이 표시
  showUrlOverlay(window.location.href, platform);
};

// 기존 버튼 제거
const removeExistingButton = () => {
  const existingButton = document.getElementById("fact-check-page-button");
  if (existingButton) {
    existingButton.remove();
  }
};

// 버튼 숨기기
const hidePageButton = () => {
  const button = document.getElementById("fact-check-page-button");
  if (button) {
    button.style.display = "none";
  }
};

// 버튼 다시 표시
const showPageButtonAgain = () => {
  const url = window.location.href;
  if (isYouTubePage(url)) {
    showYouTubeButton();
  } else if (isInstagramPage(url)) {
    showInstagramButton();
  }
};

// URL 오버레이 표시
const showUrlOverlay = (url, platform) => {
  removeUrlOverlay();

  const overlay = document.createElement("div");
  overlay.id = "fact-check-url-overlay";
  overlay.className = "fact-check-url-overlay";

  const platformName = platform === "youtube" ? "YouTube" : "Instagram";

  overlay.innerHTML = `
    <div class="url-overlay-content">
      <div class="url-overlay-header">
        <h3>${platformName} 콘텐츠 팩트 체크</h3>
        <button class="close-overlay-btn" id="closeUrlOverlay">✕</button>
      </div>
      <div class="url-overlay-body">
        <div class="url-display">
          <strong>URL:</strong>
          <p>${url}</p>
        </div>
        <p class="url-overlay-note">이 콘텐츠의 팩트 체크를 진행합니다.</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 닫기 버튼 이벤트 리스너
  const closeBtn = document.getElementById("closeUrlOverlay");
  closeBtn.addEventListener("click", () => {
    removeUrlOverlay();
    showPageButtonAgain();
  });
};

// URL 오버레이 제거
const removeUrlOverlay = () => {
  const overlay = document.getElementById("fact-check-url-overlay");
  if (overlay) {
    overlay.remove();
  }
};

// 페이지 로드 시 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePageSpecificButtons);
} else {
  initializePageSpecificButtons();
}

// URL 변경 감지 (SPA 페이지 대응)
let currentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    // 기존 버튼/오버레이 제거
    removeExistingButton();
    removeUrlOverlay();
    // 새로운 페이지에 맞는 버튼 표시
    initializePageSpecificButtons();
  }
}, 1000);

// Background script로부터 메시지 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);
  if (request.type === "SHOW_FACT_CHECK_POPUP") {
    showFactCheckPopup(request.data);
  } else if (request.type === "SHOW_LOADING") {
    showLoadingOverlay(request.data.message);
  } else if (request.type === "SHOW_RESULT_MODAL") {
    hideLoadingOverlay();
    showResultModal(request.data);
  } else if (request.type === "SHOW_ERROR") {
    hideLoadingOverlay();
    showErrorModal(request.data);
  }
});

// 팩트 체크 팝업 표시
const showFactCheckPopup = (data) => {
  console.log("Showing fact check popup:", data);

  // 기존 팝업이 있으면 제거
  removeExistingPopup();

  // 팝업 생성
  const popup = createPopup(data);
  document.body.appendChild(popup);
  console.log("Popup added to DOM");

  // 자동으로 닫히도록 설정 (3초 후)
  setTimeout(() => {
    removeExistingPopup();
  }, 3000);
};

// 기존 팝업 제거
const removeExistingPopup = () => {
  const existingPopup = document.getElementById("fact-check-popup");
  if (existingPopup) {
    existingPopup.remove();
  }
};

// 팝업 생성 (우측 하단 오버레이)
const createPopup = (data) => {
  const popup = document.createElement("div");
  popup.id = "fact-check-popup";
  popup.className = "fact-check-popup";

  if (data.type === "text") {
    popup.innerHTML = createTextCheckContent(data.content);
  } else if (data.type === "image") {
    popup.innerHTML = createImageCheckContent(data.content);
  }

  return popup;
};

// 텍스트 팩트 체크 내용 생성
const createTextCheckContent = (text) => {
  return `
    <div class="fact-check-content">
      <div class="check-icon">✓</div>
      <div class="check-message">
        <strong>팩트체크 요청완료</strong>
        <p>텍스트 분석이 완료되었습니다</p>
      </div>
    </div>
  `;
};

// 이미지 팩트 체크 내용 생성
const createImageCheckContent = (imageUrl) => {
  return `
    <div class="fact-check-content">
      <div class="check-icon">✓</div>
      <div class="check-message">
        <strong>팩트체크 요청완료</strong>
        <p>이미지 분석이 완료되었습니다</p>
      </div>
    </div>
  `;
};

// 로딩 오버레이 표시
const showLoadingOverlay = (message) => {
  removeLoadingOverlay();

  const overlay = document.createElement("div");
  overlay.id = "fact-check-loading-overlay";
  overlay.className = "fact-check-loading-overlay";

  overlay.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <p class="loading-message">${message}</p>
    </div>
  `;

  document.body.appendChild(overlay);
};

// 로딩 오버레이 제거
const hideLoadingOverlay = () => {
  removeLoadingOverlay();
};

const removeLoadingOverlay = () => {
  const overlay = document.getElementById("fact-check-loading-overlay");
  if (overlay) {
    overlay.remove();
  }
};

// 결과 모달 표시
const showResultModal = (data) => {
  removeResultModal();

  const modal = document.createElement("div");
  modal.id = "fact-check-result-modal";
  modal.className = "fact-check-result-modal";

  const { result, rawModelResponse } = data;

  modal.innerHTML = `
    <div class="modal-backdrop" onclick="document.getElementById('fact-check-result-modal').remove()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>📊 팩트 체크 결과</h2>
        <button class="modal-close-btn" onclick="document.getElementById('fact-check-result-modal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="result-section">
          <div class="accuracy-badge">
            <span class="accuracy-label">정확도</span>
            <span class="accuracy-value">${result.accuracy}</span>
          </div>
        </div>
        
        <div class="result-section">
          <h3>분석 결과</h3>
          <p class="reason-text">${result.reason}</p>
        </div>

        ${
          result.urls && result.urls.length > 0
            ? `
          <div class="result-section">
            <h3>참고 레퍼런스</h3>
            <ul class="reference-list">
              ${result.urls.map((url) => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></li>`).join("")}
            </ul>
          </div>
        `
            : ""
        }

        ${
          rawModelResponse
            ? `
          <div class="result-section">
            <h3>상세 분석</h3>
            <div class="raw-response">
              <pre>${escapeHtml(rawModelResponse)}</pre>
            </div>
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

// 에러 모달 표시
const showErrorModal = (data) => {
  removeResultModal();

  const modal = document.createElement("div");
  modal.id = "fact-check-result-modal";
  modal.className = "fact-check-result-modal";

  // 줄바꿈을 <br>로 변환
  const formatErrorMessage = (text) => {
    return escapeHtml(text).replace(/\n/g, "<br>");
  };

  modal.innerHTML = `
    <div class="modal-backdrop" onclick="document.getElementById('fact-check-result-modal').remove()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>❌ 오류 발생</h2>
        <button class="modal-close-btn" onclick="document.getElementById('fact-check-result-modal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="error-message">
          <p>${formatErrorMessage(data.message)}</p>
          ${data.error ? `<p class="error-detail">${formatErrorMessage(data.error)}</p>` : ""}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

// 결과 모달 제거
const removeResultModal = () => {
  const modal = document.getElementById("fact-check-result-modal");
  if (modal) {
    modal.remove();
  }
};

// HTML 이스케이프 유틸리티
const escapeHtml = (text) => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};
