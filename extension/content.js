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

  const currentUrl = window.location.href;

  // URL 오버레이 표시
  showUrlOverlay(currentUrl, platform);

  // 영상 팩트 체크 요청
  requestVideoFactCheck(currentUrl, platform);
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

// 영상 팩트 체크 요청
const requestVideoFactCheck = (url, platform) => {
  const requestData = { url, platform };

  console.log("========== Video Fact Check Request (Content) ==========");
  console.log("Request Body:", JSON.stringify(requestData, null, 2));
  console.log("========================================================");

  chrome.runtime.sendMessage(
    {
      type: "REQUEST_VIDEO_FACT_CHECK",
      data: requestData,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Video fact check request error:",
          chrome.runtime.lastError
        );
        removeUrlOverlay();
        showPageButtonAgain();
        return;
      }

      console.log(
        "========== Video Fact Check Response (Content) =========="
      );
      console.log("Response Body:", JSON.stringify(response, null, 2));
      console.log("=========================================================");

      if (!response || !response.success) {
        removeUrlOverlay();
        showPageButtonAgain();
      }
    }
  );
};

// 페이지 로드 시 초기화는 아래에서 처리

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

// 영상 팩트 체크 결과 모달 표시
const showVideoResultModal = (data) => {
  removeResultModal();

  const modal = document.createElement("div");
  modal.id = "fact-check-result-modal";
  modal.className = "fact-check-result-modal video";

  const platformName =
    data?.platform === "youtube"
      ? "YouTube"
      : data?.platform === "instagram"
      ? "Instagram"
      : "Video";

  const summaryText = data?.result
    ? escapeHtml(data.result)
    : "영상 분석 결과를 불러오지 못했습니다.";

  const detailText =
    data?.rawResponse?.detail ||
    data?.rawResponse?.description ||
    data?.rawResponse?.summary ||
    "";

  const referencesRaw =
    data?.rawResponse?.references ||
    data?.rawResponse?.reference_urls ||
    data?.rawResponse?.urls ||
    [];

  const references = Array.isArray(referencesRaw)
    ? referencesRaw
    : typeof referencesRaw === "string" && referencesRaw.length > 0
    ? [referencesRaw]
    : [];

  modal.innerHTML = `
    <div class="modal-backdrop" onclick="document.getElementById('fact-check-result-modal').remove()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>🎬 ${platformName} 영상 팩트 체크 결과</h2>
        <button class="modal-close-btn" onclick="document.getElementById('fact-check-result-modal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="result-section">
          <h3>결과 요약</h3>
          <p class="video-result-summary">${summaryText}</p>
        </div>

        <div class="result-section">
          <h3>신뢰 지표</h3>
          <div class="video-score-grid">
            <div class="video-score-card">
              <span class="score-label">FFT Artifact Score</span>
              <span class="score-value">${escapeHtml(
                data?.fftArtifactScore ?? "-"
              )}</span>
            </div>
            <div class="video-score-card">
              <span class="score-label">Action Pattern Score</span>
              <span class="score-value">${escapeHtml(
                data?.actionPatternScore ?? "-"
              )}</span>
            </div>
          </div>
        </div>

        ${
          detailText
            ? `
        <div class="result-section">
          <h3>상세 설명</h3>
          <p class="video-detail-text">${escapeHtml(detailText)}</p>
        </div>
        `
            : ""
        }

        ${
          references.length > 0
            ? `
        <div class="result-section">
          <h3>참고 레퍼런스</h3>
          <ul class="reference-list">
            ${references
              .map(
                (ref) =>
                  `<li><a href="${ref}" target="_blank" rel="noopener noreferrer">${ref}</a></li>`
              )
              .join("")}
          </ul>
        </div>
        `
            : ""
        }
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

// ==================== 백그라운드 감지 기능 ====================

// 상태 추적
let currentPageUrl = window.location.href;
let isChecking = false;
let hasCheckedCurrentPage = false;
let autoFactCheckTimeoutId = null;
let isBackgroundDetectionEnabled = true;
let isGlobalFactCheckEnabled = true;

const applyBackgroundDetectionSetting = (enabled) => {
  isBackgroundDetectionEnabled = enabled;

  if (!enabled) {
    console.log("Background detection disabled via settings");
    hasCheckedCurrentPage = true;
    if (autoFactCheckTimeoutId) {
      clearTimeout(autoFactCheckTimeoutId);
      autoFactCheckTimeoutId = null;
    }
    isChecking = false;
    removeBackgroundDetectionLoading();
  } else {
    console.log("Background detection enabled via settings");
    hasCheckedCurrentPage = false;
    scheduleAutoFactCheck(500);
  }
};

const applyGlobalFactCheckSetting = (enabled) => {
  isGlobalFactCheckEnabled = enabled;

  if (!enabled) {
    console.log("Global fact check disabled via settings");
    hasCheckedCurrentPage = true;
    if (autoFactCheckTimeoutId) {
      clearTimeout(autoFactCheckTimeoutId);
      autoFactCheckTimeoutId = null;
    }
    isChecking = false;
    removeBackgroundDetectionLoading();
  } else {
    console.log("Global fact check enabled via settings");
    hasCheckedCurrentPage = false;
    scheduleAutoFactCheck(500);
  }
};

const loadBackgroundDetectionSetting = () => {
  chrome.storage.sync.get(
    ["isBackgroundDetectionEnabled", "isFactCheckEnabled"],
    (result) => {
      const backgroundEnabled =
        typeof result.isBackgroundDetectionEnabled === "boolean"
          ? result.isBackgroundDetectionEnabled
          : true;
      const factCheckEnabled =
        typeof result.isFactCheckEnabled === "boolean"
          ? result.isFactCheckEnabled
          : true;

      applyGlobalFactCheckSetting(factCheckEnabled);
      applyBackgroundDetectionSetting(backgroundEnabled);
    }
  );
};

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  if (Object.prototype.hasOwnProperty.call(changes, "isBackgroundDetectionEnabled")) {
    const newValue = changes.isBackgroundDetectionEnabled.newValue;
    const enabled =
      typeof newValue === "boolean" ? newValue : true;
    applyBackgroundDetectionSetting(enabled);
  }

  if (Object.prototype.hasOwnProperty.call(changes, "isFactCheckEnabled")) {
    const newValue = changes.isFactCheckEnabled.newValue;
    const enabled =
      typeof newValue === "boolean" ? newValue : true;
    applyGlobalFactCheckSetting(enabled);
  }
});

const scheduleAutoFactCheck = (delay = 2000) => {
  if (!isBackgroundDetectionEnabled || !isGlobalFactCheckEnabled) {
    return;
  }
  if (hasCheckedCurrentPage || isChecking) {
    return;
  }

  if (autoFactCheckTimeoutId) {
    clearTimeout(autoFactCheckTimeoutId);
  }

  autoFactCheckTimeoutId = setTimeout(() => {
    autoFactCheckTimeoutId = null;
    requestAutoFactCheck();
  }, delay);
};

// 페이지 전체 텍스트 추출
const getPageText = () => {
  const text = document.body ? document.body.innerText : "";
  if (!text) {
    return null;
  }

  let normalizedText = text.replace(/\s+/g, " ").trim();

  if (normalizedText.length < 50) {
    return null;
  }

  if (normalizedText.length > 5000) {
    normalizedText = normalizedText.substring(0, 5000);
  }

  return normalizedText;
};

// 자동 Fact Check 요청
const requestAutoFactCheck = () => {
  if (!isBackgroundDetectionEnabled || !isGlobalFactCheckEnabled) {
    console.log("Auto fact check disabled by settings, skipping request");
    return;
  }

  if (isChecking || hasCheckedCurrentPage) {
    return;
  }

  const pageText = getPageText();
  if (!pageText) {
    hasCheckedCurrentPage = true;
    return;
  }

  currentPageUrl = window.location.href;
  isChecking = true;
  hasCheckedCurrentPage = true;

  const requestData = {
    text: pageText,
    url: currentPageUrl,
  };

  console.log("========== Auto Fact Check Request (Content) ==========");
  console.log("Request Body:", JSON.stringify(requestData, null, 2));
  console.log("======================================================");

  showBackgroundDetectionLoading();

  chrome.runtime.sendMessage(
    {
      type: "AUTO_FACT_CHECK_TEXT",
      data: requestData,
    },
    (response) => {
      isChecking = false;
      console.log("========== Auto Fact Check Response (Content) ==========");
      console.log("Response Body:", JSON.stringify(response, null, 2));
      console.log("=======================================================");

      removeBackgroundDetectionLoading();

      if (chrome.runtime.lastError) {
        console.error("Auto fact check error:", chrome.runtime.lastError);
        return;
      }

      if (response && response.success && response.data && response.data.skipped) {
        console.log("Auto fact check skipped:", response.data);
      }
    }
  );
};

// 경고 오버레이 표시
const showWarningOverlay = (isCurrentPage, url) => {
  removeWarningOverlay();

  const overlay = document.createElement("div");
  overlay.id = "fact-check-warning-overlay";
  overlay.className = "fact-check-warning-overlay";

  const pageInfo = isCurrentPage
    ? "현재페이지"
    : `이전 페이지 중 ${url} 페이지에서`;

  overlay.innerHTML = `
    <div class="warning-content">
      <div class="warning-icon">⚠️</div>
      <div class="warning-message">
        <strong>Fact check 결과 거짓 정보가 포함되어있을 수 있습니다. 유의해주세요</strong>
        <p class="warning-page-info">${pageInfo}</p>
      </div>
      <button class="warning-close-btn" id="closeWarningOverlay">✕</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // 닫기 버튼 이벤트 리스너
  const closeBtn = document.getElementById("closeWarningOverlay");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      removeWarningOverlay();
    });
  }

  // 10초 후 자동 닫기
  setTimeout(() => {
    removeWarningOverlay();
  }, 10000);
};

// 경고 오버레이 제거
const removeWarningOverlay = () => {
  const overlay = document.getElementById("fact-check-warning-overlay");
  if (overlay) {
    overlay.remove();
  }
};

// 실시간 감지 오버레이 제거
const removeRealtimeDetectionOverlay = () => {
  const overlay = document.getElementById(
    "fact-check-realtime-detection-overlay"
  );
  if (overlay) {
    overlay.remove();
  }
};

// 백그라운드 감지 로딩 애니메이션 표시
const showBackgroundDetectionLoading = () => {
  removeBackgroundDetectionLoading();

  const loadingOverlay = document.createElement("div");
  loadingOverlay.id = "fact-check-background-detection-loading";
  loadingOverlay.className = "fact-check-background-detection-loading";

  loadingOverlay.innerHTML = `
    <div class="background-detection-loading-content">
      <div class="background-detection-loading-spinner"></div>
      <div class="background-detection-loading-tooltip">
        실시간 팩트체크 감지중입니다
      </div>
    </div>
  `;

  document.body.appendChild(loadingOverlay);
};

// 백그라운드 감지 로딩 애니메이션 제거
const removeBackgroundDetectionLoading = () => {
  const loadingOverlay = document.getElementById(
    "fact-check-background-detection-loading"
  );
  if (loadingOverlay) {
    loadingOverlay.remove();
  }
};

// API URL 경고 오버레이 표시
const showApiUrlWarningOverlay = (message) => {
  removeApiUrlWarningOverlay();

  const overlay = document.createElement("div");
  overlay.id = "fact-check-api-url-warning-overlay";
  overlay.className = "fact-check-api-url-warning-overlay";

  overlay.innerHTML = `
    <div class="api-url-warning-content">
      <div class="api-url-warning-icon">⚠️</div>
      <div class="api-url-warning-message">
        <strong>API Base URL 설정 필요</strong>
        <p>${message}</p>
      </div>
      <button class="api-url-warning-close-btn" id="closeApiUrlWarningOverlay">✕</button>
    </div>
  `;

  document.body.appendChild(overlay);
  // 닫기 버튼 이벤트 리스너
  const closeBtn = document.getElementById("closeApiUrlWarningOverlay");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      removeApiUrlWarningOverlay();
    });
  }

  // 10초 후 자동 닫기
  setTimeout(() => {
    removeApiUrlWarningOverlay();
  }, 10000);
};

// API URL 경고 오버레이 제거
const removeApiUrlWarningOverlay = () => {
  const overlay = document.getElementById("fact-check-api-url-warning-overlay");
  if (overlay) {
    overlay.remove();
  }
};

// Background script로부터 메시지 수신 업데이트
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("========== Content Script Message Received ==========");
  console.log("Message Type:", request.type);
  console.log("Message Data:", JSON.stringify(request.data, null, 2));
  console.log("=====================================================");

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
  } else if (request.type === "SHOW_WARNING_OVERLAY") {
    const { isCurrentPage, url } = request.data;
    showWarningOverlay(isCurrentPage, url);
  } else if (request.type === "SHOW_API_URL_WARNING") {
    hideLoadingOverlay();
    showApiUrlWarningOverlay(request.data.message);
  } else if (request.type === "SHOW_VIDEO_RESULT_MODAL") {
    hideLoadingOverlay();
    removeUrlOverlay();
    showVideoResultModal(request.data);
    showPageButtonAgain();
  }
});

// URL 변경 감지 업데이트 (경고 오버레이도 제거)
let currentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    currentPageUrl = currentUrl;
    // 기존 버튼/오버레이 제거
    removeExistingButton();
    removeUrlOverlay();
    removeWarningOverlay();
    removeRealtimeDetectionOverlay();
    removeApiUrlWarningOverlay();
    removeBackgroundDetectionLoading();
    // 상태 초기화
    isChecking = false;
    hasCheckedCurrentPage = false;
    loadBackgroundDetectionSetting();
    // 새로운 페이지에 맞는 버튼 표시
    initializePageSpecificButtons();
    scheduleAutoFactCheck(800);
  }
}, 1000);

// 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initializePageSpecificButtons();
    loadBackgroundDetectionSetting();
  });
} else {
  initializePageSpecificButtons();
  loadBackgroundDetectionSetting();
}
