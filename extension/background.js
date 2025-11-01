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

  chrome.storage.sync.get(
    ["isFactCheckEnabled", "isBackgroundDetectionEnabled"],
    (result) => {
      const updates = {};

      if (typeof result.isFactCheckEnabled !== "boolean") {
        updates.isFactCheckEnabled = true;
      }

      if (typeof result.isBackgroundDetectionEnabled !== "boolean") {
        updates.isBackgroundDetectionEnabled = true;
      }

      if (Object.keys(updates).length > 0) {
        chrome.storage.sync.set(updates);
      }
    }
  );

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

  console.log("========== Text Fact Check Request ==========");
  console.log("Request Body:", JSON.stringify({ text: selectedText }, null, 2));
  console.log("==============================================");

  // Storage에서 API URL 가져오기
  const apiBaseUrl = await getApiBaseUrl();

  // API URL이 설정되지 않은 경우 경고 오버레이 표시
  if (!apiBaseUrl) {
    sendMessageToTab(tab.id, {
      type: "SHOW_API_URL_WARNING",
      data: {
        message:
          "API Base URL이 설정되지 않았습니다. 팝업에서 API Base URL을 설정해주세요.",
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
      console.log("========== Text Fact Check Response ==========");
      console.log("Response Body:", JSON.stringify(response, null, 2));
      console.log("==============================================");

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
      console.error("========== Text Fact Check Error ==========");
      console.error("Error:", error);
      console.error("==========================================");

      // API URL 관련 에러인지 확인
      const isApiUrlError =
        error.message.includes("API URL") ||
        error.message.includes("API 서버에 연결할 수 없습니다") ||
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError");

      if (isApiUrlError) {
        // 잘못된 URL인 경우 경고 오버레이 표시
        sendMessageToTab(tab.id, {
          type: "SHOW_API_URL_WARNING",
          data: {
            message:
              "API Base URL을 확인해주세요. 잘못된 URL이거나 서버에 연결할 수 없습니다.",
          },
        });
      } else {
        // 그 외 에러는 기존 에러 모달 표시
        sendMessageToTab(tab.id, {
          type: "SHOW_ERROR",
          data: {
            message: "팩트 체크 요청 중 오류가 발생했습니다.",
            error: error.message,
          },
        });
      }
    });
};

// API 요청 함수
const fetchFactCheckAPI = async (text, apiBaseUrl) => {
  const url = `${apiBaseUrl}/verify/text`;
  const requestBody = { text: text };

  console.log("========== API Request ==========");
  console.log("URL:", url);
  console.log("Method: POST");
  console.log("Request Body:", JSON.stringify(requestBody, null, 2));
  console.log("===================================");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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
      console.error("========== API Error Response ==========");
      console.error("Status:", response.status);
      console.error("Status Text:", response.statusText);
      console.error("Error Body:", errorText);
      console.error("=========================================");
      throw new Error(
        `API 요청 실패 (${response.status}): ${response.statusText}`
      );
    }

    const jsonData = await response.json();
    console.log("========== API Response ==========");
    console.log("Response Body:", JSON.stringify(jsonData, null, 2));
    console.log("===================================");
    return jsonData;
  } catch (error) {
    console.error("========== API Request Error ==========");
    console.error("Error:", error);
    console.error("========================================");

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

const fetchImageFactCheckAPI = async (imageUrl, apiBaseUrl) => {
  const url = `${apiBaseUrl}/verify/image`;
  const requestBody = { image_url: imageUrl };

  console.log("========== Image API Request ==========");
  console.log("URL:", url);
  console.log("Method: POST");
  console.log("Request Body:", JSON.stringify(requestBody, null, 2));
  console.log("=======================================");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Image API Response Status:", response.status);
    console.log(
      "Image API Response Headers:",
      response.headers.get("content-type")
    );

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const textResponse = await response.text();
      console.error(
        "Image API Non-JSON response received:",
        textResponse.substring(0, 500)
      );

      if (response.status === 404) {
        throw new Error(
          `이미지 팩트 체크 API 엔드포인트를 찾을 수 없습니다. URL을 확인해주세요: ${url}`
        );
      } else if (response.status === 0 || response.status === 500) {
        throw new Error(
          `이미지 팩트 체크 서버 오류가 발생했습니다. API 서버가 정상적으로 작동하는지 확인해주세요.`
        );
      } else if (
        textResponse.includes("<!doctype") ||
        textResponse.includes("<!DOCTYPE")
      ) {
        throw new Error(
          `이미지 팩트 체크 API 서버가 HTML을 반환했습니다. API URL이 올바른지 확인해주세요.\n요청 URL: ${url}\n응답 상태: ${response.status}`
        );
      } else {
        throw new Error(
          `예상치 못한 이미지 API 응답 형식입니다. (Content-Type: ${contentType})`
        );
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("========== Image API Error Response ==========");
      console.error("Status:", response.status);
      console.error("Status Text:", response.statusText);
      console.error("Error Body:", errorText);
      console.error("================================================");
      throw new Error(
        `이미지 팩트 체크 API 요청 실패 (${response.status}): ${response.statusText}`
      );
    }

    const jsonData = await response.json();
    console.log("========== Image API Response ==========");
    console.log("Response Body:", JSON.stringify(jsonData, null, 2));
    console.log("========================================");
    return jsonData;
  } catch (error) {
    console.error("========== Image API Request Error ==========");
    console.error("Error:", error);
    console.error("=============================================");

    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError")
    ) {
      throw new Error(
        `이미지 팩트 체크 API 서버에 연결할 수 없습니다.\n\n가능한 원인:\n1. API URL이 올바른지 확인해주세요: ${url}\n2. 서버가 실행 중인지 확인해주세요\n3. CORS 설정이 올바른지 확인해주세요`
      );
    }

    throw error;
  }
};

// 이미지 팩트 체크 처리
const handleImageFactCheck = async (info, tab) => {
  const imageUrl = info.srcUrl;

  if (!imageUrl) {
    console.error("No image URL found for image fact check");
    return;
  }

  console.log("========== Image Fact Check Request ==========");
  console.log("Image URL:", imageUrl);
  console.log("==============================================");

  const apiBaseUrl = await getApiBaseUrl();
  if (!apiBaseUrl) {
    sendMessageToTab(tab.id, {
      type: "SHOW_API_URL_WARNING",
      data: {
        message:
          "API Base URL이 설정되지 않았습니다. 팝업에서 API Base URL을 설정해주세요.",
      },
    });
    return;
  }

  sendMessageToTab(tab.id, {
    type: "SHOW_LOADING",
    data: {
      message: "요청한 작업을 처리중입니다",
    },
  });

  try {
    const response = await fetchImageFactCheckAPI(imageUrl, apiBaseUrl);

    console.log("========== Image Fact Check API Response ==========");
    console.log("Response Body:", JSON.stringify(response, null, 2));
    console.log("===================================================");

    const payload = {
      imageUrl,
      result: response.result,
      rawResponse: response,
    };

    sendMessageToTab(tab.id, {
      type: "SHOW_IMAGE_RESULT_MODAL",
      data: payload,
    });
  } catch (error) {
    console.error("========== Image Fact Check Error ==========");
    console.error("Error:", error);
    console.error("Error Message:", error.message);
    console.error("============================================");

    const isApiUrlError =
      error.message.includes("API URL") ||
      error.message.includes("API 서버에 연결할 수 없습니다") ||
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError");

    if (isApiUrlError) {
      sendMessageToTab(tab.id, {
        type: "SHOW_API_URL_WARNING",
        data: {
          message:
            "API Base URL을 확인해주세요. 잘못된 URL이거나 서버에 연결할 수 없습니다.",
        },
      });
    } else {
      sendMessageToTab(tab.id, {
        type: "SHOW_ERROR",
        data: {
          message: "이미지 팩트 체크 요청 중 오류가 발생했습니다.",
          error: error.message,
        },
      });
    }
  }
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

// 자동 팩트 체크 처리 (백그라운드 감지)
const handleAutoFactCheck = async (text, url, tabId) => {
  console.log("========== Auto Fact Check Request ==========");
  console.log("Request Body:", JSON.stringify({ text, url }, null, 2));
  console.log("==============================================");

  // Storage에서 활성화 상태 확인
  const storage = await chrome.storage.sync.get([
    "isFactCheckEnabled",
    "isBackgroundDetectionEnabled",
  ]);

  const factCheckEnabled =
    typeof storage.isFactCheckEnabled === "boolean"
      ? storage.isFactCheckEnabled
      : true;
  const backgroundDetectionEnabled =
    typeof storage.isBackgroundDetectionEnabled === "boolean"
      ? storage.isBackgroundDetectionEnabled
      : true;

  if (!factCheckEnabled) {
    console.log("Auto fact check skipped: fact check is disabled");
    return { skipped: true, reason: "fact_check_disabled" };
  }

  if (!backgroundDetectionEnabled) {
    console.log("Auto fact check skipped: background detection is disabled");
    return { skipped: true, reason: "background_detection_disabled" };
  }

  // API URL 가져오기
  const apiBaseUrl = await getApiBaseUrl();
  if (!apiBaseUrl) {
    console.log("API URL not configured, skipping auto fact check");
    // API URL이 없을 때 경고 오버레이 표시
    sendMessageToTab(tabId, {
      type: "SHOW_API_URL_WARNING",
      data: {
        message:
          "API Base URL이 설정되지 않았습니다. 팝업에서 API Base URL을 설정해주세요.",
      },
    });
    throw new Error("API URL not configured");
  }

  console.log("========== Starting API Request ==========");
  console.log("API Base URL:", apiBaseUrl);
  console.log("Text length:", text.length);
  console.log("===========================================");

  try {
    // API 요청 전송
    const response = await fetchFactCheckAPI(text, apiBaseUrl);

    console.log("========== Auto Fact Check API Response ==========");
    console.log("Response Body:", JSON.stringify(response, null, 2));
    console.log("==================================================");

    // 정확도가 낮은 경우 (거짓 정보 가능성) 경고 표시
    // accuracy가 문자열 형태 (예: "82%")로 오므로 숫자로 변환
    const accuracyValue = parseFloat(response.result.accuracy.replace("%", ""));

    console.log("========== Accuracy Check ==========");
    console.log("Accuracy Value:", accuracyValue);
    console.log("Threshold: 70");
    console.log("Should show warning:", accuracyValue < 70);
    console.log("===================================");

    // 정확도가 70% 미만이면 거짓 정보로 판단
    if (accuracyValue < 70) {
      // 현재 탭의 URL 확인
      const currentTab = await chrome.tabs.get(tabId);
      const isCurrentPage = currentTab.url === url;

      console.log("========== Showing Warning Overlay ==========");
      console.log("Is Current Page:", isCurrentPage);
      console.log("URL:", url);
      console.log("Current Tab URL:", currentTab.url);
      console.log("==============================================");

      // 경고 오버레이 표시
      sendMessageToTab(tabId, {
        type: "SHOW_WARNING_OVERLAY",
        data: {
          isCurrentPage: isCurrentPage,
          url: url,
        },
      });
    }

    return response;
  } catch (error) {
    console.error("========== Auto Fact Check Error ==========");
    console.error("Error:", error);
    console.error("Error Message:", error.message);
    console.error("============================================");

    // API URL 관련 에러인지 확인
    const isApiUrlError =
      error.message.includes("API URL") ||
      error.message.includes("API 서버에 연결할 수 없습니다") ||
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError");

    if (isApiUrlError) {
      // 잘못된 URL인 경우 경고 오버레이 표시
      sendMessageToTab(tabId, {
        type: "SHOW_API_URL_WARNING",
        data: {
          message:
            "API Base URL을 확인해주세요. 잘못된 URL이거나 서버에 연결할 수 없습니다.",
        },
      });
    }

    // 에러를 다시 throw하여 상위에서 처리할 수 있도록 함
    throw error;
  }
};

// Popup에서 오는 메시지 처리
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("========== Background Script Message Received ==========");
  console.log("Message Type:", request.type);
  console.log(
    "Message Data:",
    JSON.stringify(request.data || request, null, 2)
  );
  console.log("=======================================================");

  if (request.type === "TOGGLE_FACT_CHECK") {
    const enabled = !!request.enabled;
    isFactCheckEnabled = enabled;
    chrome.storage.sync.set({ isFactCheckEnabled: enabled }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Failed to persist fact check toggle:",
          chrome.runtime.lastError.message
        );
      }
      sendResponse({ success: true, enabled });
    });
    return true;
  } else if (request.type === "GET_FACT_CHECK_STATUS") {
    chrome.storage.sync.get(["isFactCheckEnabled"], (result) => {
      console.log("========== Fact Check Status Response ==========");
      console.log(
        "Response Body:",
        JSON.stringify({ enabled: result.isFactCheckEnabled ?? true }, null, 2)
      );
      console.log("================================================");
      sendResponse({ enabled: result.isFactCheckEnabled ?? true });
    });
    return true; // 비동기 응답을 위해 true 반환
  } else if (request.type === "TOGGLE_BACKGROUND_DETECTION") {
    const enabled = !!request.enabled;
    chrome.storage.sync.set(
      { isBackgroundDetectionEnabled: enabled },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Failed to persist background detection toggle:",
            chrome.runtime.lastError.message
          );
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        sendResponse({ success: true, enabled });
      }
    );
    return true;
  } else if (request.type === "GET_BACKGROUND_DETECTION_STATUS") {
    chrome.storage.sync.get(["isBackgroundDetectionEnabled"], (result) => {
      const enabled =
        typeof result.isBackgroundDetectionEnabled === "boolean"
          ? result.isBackgroundDetectionEnabled
          : true;
      sendResponse({ enabled });
    });
    return true;
  } else if (request.type === "API_URL_UPDATED") {
    console.log("API URL updated:", request.apiUrl);
    sendResponse({ success: true });
  } else if (request.type === "AUTO_FACT_CHECK_TEXT") {
    // 자동 팩트 체크 요청 처리
    const tabId = sender.tab?.id;
    if (!tabId) {
      console.error("No tab ID found for auto fact check");
      sendResponse({ success: false });
      return;
    }

    const { text, url } = request.data;

    handleAutoFactCheck(text, url, tabId)
      .then((responseData) => {
        console.log("========== Auto Fact Check Complete Response ==========");
        console.log(
          "Response Body:",
          JSON.stringify({ success: true, data: responseData }, null, 2)
        );
        console.log("========================================================");
        sendResponse({ success: true, data: responseData });
      })
      .catch((error) => {
        console.error("========== Auto Fact Check Error Response ==========");
        console.error(
          "Response Body:",
          JSON.stringify({ success: false, error: error.message }, null, 2)
        );
        console.error("=====================================================");
        sendResponse({ success: false, error: error.message });
      });

    return true; // 비동기 응답을 위해 true 반환 (중요!)
  } else if (request.type === "REQUEST_VIDEO_FACT_CHECK") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      console.error("No tab ID found for video fact check");
      sendResponse({ success: false, error: "Tab ID not found" });
      return;
    }

    const { url, platform } = request.data || {};

    handleVideoFactCheck(url, platform, tabId)
      .then((payload) => {
        console.log("========== Video Fact Check Complete ==========");
        console.log("Response Body:", JSON.stringify(payload, null, 2));
        console.log("===============================================");
        sendResponse({ success: true, data: payload });
      })
      .catch((error) => {
        console.error("========== Video Fact Check Error Response ==========");
        console.error(
          "Response Body:",
          JSON.stringify({ success: false, error: error.message }, null, 2)
        );
        console.error("=====================================================");
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }
});
