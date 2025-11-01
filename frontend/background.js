// Background Service Worker
// Reference: https://developer.chrome.com/docs/extensions/mv3/service_workers/

let isFactCheckEnabled = true;

// API URL을 Chrome Storage에서 가져오는 함수
const getApiBaseUrl = async () => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["apiBaseUrl"], (result) => {
      // 저장된 값이 있으면 사용, 없으면 null 반환 (사용자가 설정하도록 유도)
      if (result.apiBaseUrl) {
        resolve(result.apiBaseUrl);
      } else {
        resolve(null);
      }
    });
  });
};

// 확장 프로그램 설치 시 초기화
chrome.runtime.onInstalled.addListener(() => {
  console.log("Fact Check extension installed");

  // 초기 상태를 storage에 저장
  chrome.storage.sync.set({ isFactCheckEnabled: true });

  // 컨텍스트 메뉴 생성
  createContextMenus();
});

// 컨텍스트 메뉴 생성 함수
const createContextMenus = () => {
  // 기존 메뉴 제거
  chrome.contextMenus.removeAll(() => {
    // 텍스트 선택 시 메뉴
    chrome.contextMenus.create({
      id: "factCheckText",
      title: "Fact Check (텍스트)",
      contexts: ["selection"],
    });

    // 이미지 우클릭 시 메뉴
    chrome.contextMenus.create({
      id: "factCheckImage",
      title: "Fact Check (이미지)",
      contexts: ["image"],
    });
  });
};

// 컨텍스트 메뉴 클릭 이벤트 처리
chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.storage.sync.get(["isFactCheckEnabled"], (result) => {
    if (!result.isFactCheckEnabled) {
      console.log("Fact Check is disabled");
      return;
    }

    if (info.menuItemId === "factCheckText") {
      handleTextFactCheck(info, tab);
    } else if (info.menuItemId === "factCheckImage") {
      handleImageFactCheck(info, tab);
    }
  });
});

// 텍스트 팩트 체크 처리
const handleTextFactCheck = async (info, tab) => {
  const selectedText = info.selectionText;

  if (!selectedText || selectedText.trim().length === 0) {
    console.error("No text selected");
    return;
  }

  // Storage에서 API URL 가져오기
  const apiBaseUrl = await getApiBaseUrl();

  // API URL이 설정되지 않은 경우 에러 메시지 표시
  if (!apiBaseUrl) {
    sendMessageToTab(tab.id, {
      type: "SHOW_ERROR",
      data: {
        message: "API URL이 설정되지 않았습니다.",
        error: "팝업에서 API Base URL을 설정해주세요.",
      },
    });
    return;
  }

  // Content script에 로딩 표시 요청
  sendMessageToTab(tab.id, {
    type: "SHOW_LOADING",
    data: {
      message: "요청한 작업을 처리중입니다",
    },
  });

  // API 요청 전송
  fetchFactCheckAPI(selectedText, apiBaseUrl)
    .then((response) => {
      // 성공 시 결과 모달 표시
      sendMessageToTab(tab.id, {
        type: "SHOW_RESULT_MODAL",
        data: {
          result: response.result,
          rawModelResponse: response.raw_model_response,
        },
      });
    })
    .catch((error) => {
      console.error("API request failed:", error);
      // 에러 시 에러 메시지 표시
      sendMessageToTab(tab.id, {
        type: "SHOW_ERROR",
        data: {
          message: "팩트 체크 요청 중 오류가 발생했습니다.",
          error: error.message,
        },
      });
    });
};

// API 요청 함수
const fetchFactCheckAPI = async (text, apiBaseUrl) => {
  const url = `${apiBaseUrl}/verify/text`;

  console.log("API Request URL:", url);
  console.log("API Request Body:", { text: text.substring(0, 100) + "..." });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
      }),
    });

    console.log("API Response Status:", response.status);
    console.log("API Response Headers:", response.headers.get("content-type"));

    // Content-Type 확인
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      // HTML이나 다른 형식이 반환된 경우
      const textResponse = await response.text();
      console.error(
        "Non-JSON response received:",
        textResponse.substring(0, 500)
      );

      if (response.status === 404) {
        throw new Error(
          `API 엔드포인트를 찾을 수 없습니다. URL을 확인해주세요: ${url}`
        );
      } else if (response.status === 0 || response.status === 500) {
        throw new Error(
          `서버 오류가 발생했습니다. API 서버가 정상적으로 작동하는지 확인해주세요.`
        );
      } else if (
        textResponse.includes("<!doctype") ||
        textResponse.includes("<!DOCTYPE")
      ) {
        throw new Error(
          `API 서버가 HTML을 반환했습니다. API URL이 올바른지 확인해주세요.\n요청 URL: ${url}\n응답 상태: ${response.status}`
        );
      } else {
        throw new Error(
          `예상치 못한 응답 형식입니다. (Content-Type: ${contentType})`
        );
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      throw new Error(
        `API 요청 실패 (${response.status}): ${response.statusText}`
      );
    }

    const jsonData = await response.json();
    console.log("API Response Data:", jsonData);
    return jsonData;
  } catch (error) {
    console.error("API Request Error:", error);

    // 네트워크 오류인 경우
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError")
    ) {
      throw new Error(
        `API 서버에 연결할 수 없습니다.\n\n가능한 원인:\n1. API URL이 올바른지 확인해주세요: ${url}\n2. 서버가 실행 중인지 확인해주세요\n3. CORS 설정이 올바른지 확인해주세요`
      );
    }

    // 이미 처리된 에러는 그대로 전달
    throw error;
  }
};

// 이미지 팩트 체크 처리
const handleImageFactCheck = (info, tab) => {
  const imageUrl = info.srcUrl;

  // Content script로 메시지 전송
  sendMessageToTab(tab.id, {
    type: "SHOW_FACT_CHECK_POPUP",
    data: {
      type: "image",
      content: imageUrl,
    },
  });
};

// 탭에 메시지 전송 (에러 처리 포함)
const sendMessageToTab = (tabId, message) => {
  // 먼저 탭의 URL을 확인
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to get tab:", chrome.runtime.lastError.message);
      return;
    }

    // Chrome 특수 페이지나 확장 프로그램 페이지에서는 작동하지 않음
    const url = tab.url || "";
    const restrictedProtocols = [
      "chrome://",
      "chrome-extension://",
      "edge://",
      "about:",
    ];
    const isRestrictedPage = restrictedProtocols.some((protocol) =>
      url.startsWith(protocol)
    );

    if (isRestrictedPage) {
      console.log("Cannot run on restricted pages:", url);
      return;
    }

    // Content script로 메시지 전송 시도
    chrome.tabs.sendMessage(tabId, message, (response) => {
      // 에러 체크 - content script가 아직 로드되지 않은 경우
      if (chrome.runtime.lastError) {
        console.log("Content script not ready, injecting...");

        // Content script를 수동으로 주입
        chrome.scripting.executeScript(
          {
            target: { tabId: tabId },
            files: ["content.js"],
          },
          () => {
            if (chrome.runtime.lastError) {
              console.error(
                "Failed to inject content script:",
                chrome.runtime.lastError.message
              );
              return;
            }

            // CSS도 주입
            chrome.scripting.insertCSS(
              {
                target: { tabId: tabId },
                files: ["content.css"],
              },
              () => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Failed to inject CSS:",
                    chrome.runtime.lastError.message
                  );
                  return;
                }

                // 잠시 대기 후 메시지 재전송
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabId, message, (response) => {
                    if (chrome.runtime.lastError) {
                      console.error(
                        "Failed to send message after injection:",
                        chrome.runtime.lastError.message
                      );
                    }
                  });
                }, 100);
              }
            );
          }
        );
      }
    });
  });
};

// Popup에서 오는 메시지 처리
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "TOGGLE_FACT_CHECK") {
    isFactCheckEnabled = request.enabled;
    chrome.storage.sync.set({ isFactCheckEnabled: request.enabled });
    sendResponse({ success: true });
  } else if (request.type === "GET_FACT_CHECK_STATUS") {
    chrome.storage.sync.get(["isFactCheckEnabled"], (result) => {
      sendResponse({ enabled: result.isFactCheckEnabled ?? true });
    });
    return true; // 비동기 응답을 위해 true 반환
  } else if (request.type === "API_URL_UPDATED") {
    console.log("API URL updated:", request.apiUrl);
    sendResponse({ success: true });
  }
});
