// Popup Script
// Reference: https://developer.chrome.com/docs/extensions/mv3/user_interface/

// DOM 로드 완료 후 실행
document.addEventListener("DOMContentLoaded", () => {
  initializePopup();
});

// 팝업 초기화
const initializePopup = () => {
  loadFactCheckStatus();
  loadApiUrl();
  setupEventListeners();
};

// 팩트 체크 상태 로드
const loadFactCheckStatus = () => {
  chrome.runtime.sendMessage({ type: "GET_FACT_CHECK_STATUS" }, (response) => {
    if (response && response.enabled !== undefined) {
      const toggle = document.getElementById("factCheckToggle");
      if (toggle) {
        toggle.checked = response.enabled;
      }
    }
  });
};

// API URL 로드
const loadApiUrl = () => {
  chrome.storage.sync.get(["apiBaseUrl"], (result) => {
    const apiUrlInput = document.getElementById("apiUrlInput");
    if (apiUrlInput && result.apiBaseUrl) {
      apiUrlInput.value = result.apiBaseUrl;
    } else if (apiUrlInput) {
      // 기본값 placeholder 설정
      apiUrlInput.placeholder = "https://api.example.com";
    }
  });
};

// 이벤트 리스너 설정
const setupEventListeners = () => {
  const toggle = document.getElementById("factCheckToggle");
  const saveApiUrlBtn = document.getElementById("saveApiUrlBtn");

  if (toggle) {
    toggle.addEventListener("change", handleToggleChange);
  }

  if (saveApiUrlBtn) {
    saveApiUrlBtn.addEventListener("click", handleSaveApiUrl);
  }

  // Enter 키로 저장
  const apiUrlInput = document.getElementById("apiUrlInput");
  if (apiUrlInput) {
    apiUrlInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleSaveApiUrl();
      }
    });
  }
};

// 토글 변경 처리
const handleToggleChange = (event) => {
  const isEnabled = event.target.checked;

  chrome.runtime.sendMessage(
    {
      type: "TOGGLE_FACT_CHECK",
      enabled: isEnabled,
    },
    (response) => {
      if (response && response.success) {
        console.log(`Fact Check ${isEnabled ? "enabled" : "disabled"}`);
        showStatusMessage(isEnabled);
      }
    }
  );
};

// 상태 메시지 표시
const showStatusMessage = (isEnabled) => {
  // 간단한 피드백 효과
  const toggle = document.getElementById("factCheckToggle");
  const parent = toggle.closest(".setting-item");

  parent.style.transition = "background-color 0.3s";
  parent.style.backgroundColor = isEnabled ? "#d4edda" : "#f8d7da";

  setTimeout(() => {
    parent.style.backgroundColor = "";
  }, 500);
};

// API URL 저장 처리
const handleSaveApiUrl = () => {
  const apiUrlInput = document.getElementById("apiUrlInput");
  const status = document.getElementById("apiUrlStatus");

  if (!apiUrlInput || !status) return;

  const apiUrl = apiUrlInput.value.trim();

  if (!apiUrl) {
    showApiUrlStatus("API URL을 입력해주세요", "error");
    return;
  }

  // URL 유효성 검사
  try {
    new URL(apiUrl);
  } catch (e) {
    showApiUrlStatus("올바른 URL 형식이 아닙니다", "error");
    return;
  }

  // Chrome Storage에 저장
  chrome.storage.sync.set({ apiBaseUrl: apiUrl }, () => {
    showApiUrlStatus("저장되었습니다!", "success");

    // Service Worker에 알림
    chrome.runtime.sendMessage(
      {
        type: "API_URL_UPDATED",
        apiUrl: apiUrl,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Failed to send message:", chrome.runtime.lastError);
        }
      }
    );
  });
};

// API URL 상태 메시지 표시
const showApiUrlStatus = (message, type) => {
  const status = document.getElementById("apiUrlStatus");
  if (!status) return;

  status.textContent = message;
  status.className = `api-url-status ${type}`;

  setTimeout(() => {
    status.textContent = "";
    status.className = "api-url-status";
  }, 3000);
};
