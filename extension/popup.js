// Popup Script
// Reference: https://developer.chrome.com/docs/extensions/mv3/user_interface/

// DOM 로드 완료 후 실행
document.addEventListener("DOMContentLoaded", () => {
  initializePopup();
});

// 팝업 초기화
const initializePopup = () => {
  loadFactCheckStatus();
  loadBackgroundDetectionStatus();
  setupEventListeners();
};

// 팩트 체크 상태 로드
const loadFactCheckStatus = () => {
  chrome.runtime.sendMessage({ type: "GET_FACT_CHECK_STATUS" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(
        "Failed to load fact check status:",
        chrome.runtime.lastError
      );
      return;
    }

    if (response && response.enabled !== undefined) {
      const toggle = document.getElementById("factCheckToggle");
      if (toggle) {
        toggle.checked = response.enabled;
      }
    }
  });
};

const loadBackgroundDetectionStatus = () => {
  chrome.runtime.sendMessage(
    { type: "GET_BACKGROUND_DETECTION_STATUS" },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Failed to load background detection status:",
          chrome.runtime.lastError
        );
        return;
      }

      if (response && response.enabled !== undefined) {
        const toggle = document.getElementById("backgroundDetectionToggle");
        if (toggle) {
          toggle.checked = response.enabled;
        }
      }
    }
  );
};

// 이벤트 리스너 설정
const setupEventListeners = () => {
  const toggle = document.getElementById("factCheckToggle");
  const backgroundToggle = document.getElementById(
    "backgroundDetectionToggle"
  );

  if (toggle) {
    toggle.addEventListener("change", handleToggleChange);
  }

  if (backgroundToggle) {
    backgroundToggle.addEventListener(
      "change",
      handleBackgroundToggleChange
    );
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
      if (chrome.runtime.lastError) {
        console.error(
          "Failed to toggle fact check:",
          chrome.runtime.lastError
        );
        return;
      }

      if (response && response.success) {
        console.log(`Fact Check ${isEnabled ? "enabled" : "disabled"}`);
        showToggleFeedback(event.target, isEnabled);
      }
    }
  );
};

const handleBackgroundToggleChange = (event) => {
  const isEnabled = event.target.checked;

  chrome.runtime.sendMessage(
    {
      type: "TOGGLE_BACKGROUND_DETECTION",
      enabled: isEnabled,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Failed to toggle background detection:",
          chrome.runtime.lastError
        );
        return;
      }

      if (response && response.success) {
        console.log(
          `Background detection ${isEnabled ? "enabled" : "disabled"}`
        );
        showToggleFeedback(event.target, isEnabled);
      }
    }
  );
};

// 상태 메시지 표시
const showToggleFeedback = (toggleElement, isEnabled) => {
  if (!toggleElement) {
    return;
  }

  const parent = toggleElement.closest(".setting-item");
  if (!parent) {
    return;
  }

  parent.style.transition = "background-color 0.3s";
  parent.style.backgroundColor = isEnabled ? "#d4edda" : "#f8d7da";

  setTimeout(() => {
    parent.style.backgroundColor = "";
  }, 500);
};
