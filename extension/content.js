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
  const safeUrl = escapeHtml(url);

  overlay.innerHTML = `
    <div class="url-overlay-content">
      <div class="url-overlay-header">
        <h3>${platformName} 콘텐츠 팩트 체크</h3>
        <button class="close-overlay-btn" id="closeUrlOverlay">✕</button>
      </div>
      <div class="url-overlay-body">
        <div class="url-display">
          <strong>URL:</strong>
          <p>${safeUrl}</p>
        </div>
        <div class="url-overlay-status">
          <div class="loading-spinner"></div>
          <div class="url-overlay-status-text">
            <p class="url-overlay-note">요청한 작업을 처리중입니다.</p>
            <p class="url-overlay-subnote">팩트 체크 분석을 준비하고 있습니다.</p>
          </div>
        </div>
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

      console.log("========== Video Fact Check Response (Content) ==========");
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
  const popup = createPopup(data);``
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

  const result = data?.result || {};
  const accuracyValue = result?.accuracy || "정보 없음";
  const accuracyReason = data?.accuracyReason || result?.accuracy_reason || "";
  const createdAtRaw = data?.createdAt;
  let createdAt = null;
  if (createdAtRaw) {
    const parsedDate = new Date(createdAtRaw);
    if (!Number.isNaN(parsedDate.valueOf())) {
      createdAt = parsedDate;
    }
  }
  const shareUrl = data?.shareUrl || "";
  const inputText = data?.inputText || "";

  const normalizedUrls = Array.isArray(result?.urls)
    ? result.urls.filter((url) => typeof url === "string" && url.trim())
    : [];

  const accuracyReasonHtml = accuracyReason
    ? `<p class="accuracy-reason">${escapeHtml(accuracyReason)}</p>`
    : "";

  const createdAtHtml = createdAt
    ? `<p class="result-meta"><strong>분석일</strong><span>${createdAt.toLocaleString()}</span></p>`
    : "";

  const referencesHtml =
    normalizedUrls.length > 0
      ? `
        <div class="result-section">
          <h3>참고 레퍼런스</h3>
          <ul class="reference-list">
            ${normalizedUrls
              .map((url) => {
                const safeUrl = escapeHtml(url);
                return `<li><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a></li>`;
              })
              .join("")}
          </ul>
        </div>
      `
      : "";

  const inputTextHtml = inputText
    ? `
        <div class="result-section">
          <h3>검증한 텍스트</h3>
          <blockquote class="input-text">${escapeHtml(inputText)}</blockquote>
        </div>
      `
    : "";

  const shareButtonState = shareUrl ? "" : "disabled";
  const shareButtonLabel = shareUrl ? "결과 공유하기" : "공유 URL 준비중";

  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>📊 팩트 체크 결과</h2>
        <button class="modal-close-btn" type="button">✕</button>
      </div>
      <div class="modal-body">
        <div class="result-section result-section--accuracy">
          <div class="accuracy-badge">
            <span class="accuracy-label">정확도</span>
            <span class="accuracy-value">${escapeHtml(accuracyValue)}</span>
          </div>
          ${accuracyReasonHtml}
          ${createdAtHtml}
        </div>

        <div class="result-section">
          <h3>분석 결과</h3>
          <p class="reason-text">${escapeHtml(
            result?.reason || "분석 결과를 불러오지 못했습니다."
          )}</p>
        </div>

        ${inputTextHtml}
        ${referencesHtml}
      </div>
      <div class="modal-footer">
        <button class="share-result-button" type="button" ${shareButtonState}>
          ${shareButtonLabel}
        </button>
        <p class="share-result-hint">${
          shareUrl
            ? "버튼을 누르면 공유 URL이 클립보드에 복사됩니다."
            : "결과 ID를 아직 받지 못해 공유 링크를 만들 수 없습니다."
        }</p>
        <p class="share-result-status" aria-live="polite"></p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  attachModalDismissHandlers(modal);

  const shareButton = modal.querySelector(".share-result-button");
  const statusLabel = modal.querySelector(".share-result-status");

  if (shareButton && shareUrl) {
    shareButton.addEventListener("click", async () => {
      if (!shareUrl) {
        return;
      }

      const originalText = shareButton.textContent;
      try {
        await copyTextToClipboard(shareUrl);
        shareButton.textContent = "복사 완료!";
        shareButton.classList.add("copied");
        if (statusLabel) {
          statusLabel.textContent = "공유 링크가 클립보드에 복사되었습니다.";
          statusLabel.classList.remove("error");
          statusLabel.classList.add("success");
        }
      } catch (error) {
        console.error("Failed to copy share URL:", error);
        shareButton.textContent = "복사 실패";
        shareButton.classList.add("error");
        if (statusLabel) {
          statusLabel.textContent =
            "클립보드 복사에 실패했습니다. 다시 시도해주세요.";
          statusLabel.classList.add("error");
          statusLabel.classList.remove("success");
        }
      } finally {
        setTimeout(() => {
          shareButton.textContent = originalText;
          shareButton.classList.remove("copied", "error");
          if (statusLabel) {
            statusLabel.textContent = "";
            statusLabel.classList.remove("success", "error");
          }
        }, 2500);
      }
    });
  }
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
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>❌ 오류 발생</h2>
        <button class="modal-close-btn" type="button">✕</button>
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
  attachModalDismissHandlers(modal);
};

// 결과 모달 제거
const removeResultModal = () => {
  const modal = document.getElementById("fact-check-result-modal");
  if (modal) {
    modal.remove();
  }
};

const attachModalDismissHandlers = (modal) => {
  if (!modal) {
    return;
  }

  const closeModal = () => {
    removeResultModal();
  };

  const closeBtn = modal.querySelector(".modal-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal, { once: true });
  }

  const backdrop = modal.querySelector(".modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener(
      "click",
      (event) => {
        if (event.target === backdrop) {
          closeModal();
        }
      },
      { once: true }
    );
  }
};

// HTML 이스케이프 유틸리티
const escapeHtml = (text) => {
  if (text === null || text === undefined) {
    return "";
  }

  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
};

const copyTextToClipboard = async (text) => {
  if (!text) {
    throw new Error("No text provided to copy");
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (successful) {
        resolve();
      } else {
        reject(new Error("execCommand copy failed"));
      }
    } catch (error) {
      reject(error);
    }
  });
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

  const detailRaw =
    data?.rawResponse?.detail ||
    data?.rawResponse?.description ||
    data?.rawResponse?.summary ||
    "";

  const detailContent = detailRaw ? escapeHtml(detailRaw) : null;

  const misinformationRaw =
    data?.rawResponse?.misinformation_result ||
    data?.rawResponse?.misinformation ||
    data?.misinformationResult ||
    data?.misinformation ||
    "";

  const misinformationText = misinformationRaw
    ? escapeHtml(misinformationRaw)
    : "사실 검증 결과는 준비중입니다.";

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

  const requestedUrl =
    typeof data?.requestedUrl === "string" && data.requestedUrl.length > 0
      ? escapeHtml(data.requestedUrl)
      : "";

  const scoreGridHtml = `
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
  `;

  const referencesHtml =
    references.length > 0
      ? `
          <ul class="reference-list">
            ${references
              .map((ref) => {
                if (typeof ref !== "string") {
                  return "";
                }
                const safeRef = escapeHtml(ref);
                return `<li><a href="${safeRef}" target="_blank" rel="noopener noreferrer">${safeRef}</a></li>`;
              })
              .join("")}
          </ul>
        `
      : `<p class="video-result-placeholder">참고 레퍼런스는 준비중입니다.</p>`;

  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>🎬 ${platformName} 영상 팩트 체크 결과</h2>
        <button class="modal-close-btn" type="button">✕</button>
      </div>
      <div class="modal-body">
        <p class="video-result-intro">Fact Check 결과는 다음과 같습니다.</p>

        ${
          requestedUrl
            ? `
        <div class="video-url-pill">
          <span class="video-url-label">분석한 영상</span>
          <span class="video-url-value">${requestedUrl}</span>
        </div>
        `
            : ""
        }

        <div class="video-result-item">
          <div class="video-result-badge">1</div>
          <div class="video-result-item-body">
            <h3>생성형 AI 요소 여부</h3>
            <p class="video-result-summary">${summaryText}</p>
            ${scoreGridHtml}
          </div>
        </div>

        <div class="video-result-item">
          <div class="video-result-badge">2</div>
          <div class="video-result-item-body">
            <h3>사실 검증</h3>
            <p class="video-result-misinformation">${misinformationText}</p>
          </div>
        </div>

        <div class="video-result-item">
          <div class="video-result-badge">3</div>
          <div class="video-result-item-body">
            <h3>상세 설명 & 레퍼런스</h3>
            ${
              detailContent
                ? `<p class="video-detail-text">${detailContent}</p>`
                : `<p class="video-result-placeholder">상세 설명은 준비중입니다.</p>`
            }
            ${referencesHtml}
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  attachModalDismissHandlers(modal);
};

// 이미지 팩트 체크 결과 모달 표시
const showImageResultModal = (data) => {
  removeResultModal();

  const modal = document.createElement("div");
  modal.id = "fact-check-result-modal";
  modal.className = "fact-check-result-modal image";

  const result = data?.result || {};
  const rawModelResponse =
    typeof data?.rawModelResponse === "string" ? data.rawModelResponse : null;

  const rawFakeValue =
    typeof result.fake === "string" ? result.fake.trim() : "";
  const fakeDisplay = rawFakeValue || "알 수 없음";
  const normalizedFake = rawFakeValue.toLowerCase();

  let defaultSummary;
  if (["true", "fake", "yes"].includes(normalizedFake)) {
    defaultSummary = "이 이미지는 딥페이크로 의심됩니다.";
  } else if (["false", "real", "no"].includes(normalizedFake)) {
    defaultSummary = "이 이미지는 진짜로 판별되었습니다.";
  } else if (rawFakeValue) {
    defaultSummary = `모델이 '${rawFakeValue}' 상태로 판정했습니다.`;
  } else {
    defaultSummary = "이미지 판별 결과를 확인할 수 없습니다.";
  }

  const reasonText =
    typeof result.reason === "string" && result.reason.trim().length > 0
      ? result.reason.trim()
      : defaultSummary;

  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>🖼️ 이미지 팩트 체크 결과</h2>
        <button class="modal-close-btn" type="button">✕</button>
      </div>
      <div class="modal-body">
        ${
          data?.imageUrl
            ? `
        <div class="result-section image-preview-section">
          <h3>분석 대상 이미지</h3>
          <div class="image-preview-wrapper">
            <img src="${escapeHtml(
              data.imageUrl
            )}" alt="팩트 체크 대상 이미지" referrerpolicy="no-referrer"/>
          </div>
        </div>
        `
            : ""
        }

        <div class="result-section">
          <h3>모델 판정</h3>
          <div class="image-score-grid">
            <div class="image-score-card">
              <span class="score-label">Fake 여부</span>
              <span class="score-value">${escapeHtml(fakeDisplay)}</span>
            </div>
          </div>
        </div>

        <div class="result-section">
          <h3>분석 요약</h3>
          <p class="image-result-summary">${escapeHtml(reasonText)}</p>
        </div>

        ${
          rawModelResponse
            ? `
        <div class="result-section">
          <h3>Raw Model Response</h3>
          <pre class="image-raw-response">${escapeHtml(rawModelResponse)}</pre>
        </div>
        `
            : ""
        }
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  attachModalDismissHandlers(modal);
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
    scheduleAutoFactCheck(2000);
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

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      "isBackgroundDetectionEnabled"
    )
  ) {
    const newValue = changes.isBackgroundDetectionEnabled.newValue;
    const enabled = typeof newValue === "boolean" ? newValue : true;
    applyBackgroundDetectionSetting(enabled);
  }

  if (Object.prototype.hasOwnProperty.call(changes, "isFactCheckEnabled")) {
    const newValue = changes.isFactCheckEnabled.newValue;
    const enabled = typeof newValue === "boolean" ? newValue : true;
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

      if (
        response &&
        response.success &&
        response.data &&
        response.data.skipped
      ) {
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
        <strong>유의해주세요. <br/>Fact check 결과 거짓 정보가 포함되어있을 수 있습니다.</strong>
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
    removeUrlOverlay();
    showPageButtonAgain();
    showErrorModal(request.data);
  } else if (request.type === "SHOW_WARNING_OVERLAY") {
    const { isCurrentPage, url } = request.data;
    showWarningOverlay(isCurrentPage, url);
  } else if (request.type === "SHOW_API_URL_WARNING") {
    hideLoadingOverlay();
    removeUrlOverlay();
    showPageButtonAgain();
    showApiUrlWarningOverlay(request.data.message);
  } else if (request.type === "SHOW_IMAGE_RESULT_MODAL") {
    hideLoadingOverlay();
    showImageResultModal(request.data);
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
