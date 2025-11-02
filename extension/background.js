// Background Service Worker
// Reference: https://developer.chrome.com/docs/extensions/mv3/service_workers/

const API_BASE_URL = "http://15.165.34.51:8000";

let isFactCheckEnabled = true;

const SHARE_BASE_URL = "http://15.165.34.51/share";

const activeRequests = new Map();

const isRequestInProgress = (tabId) => {
  return typeof tabId === "number" && activeRequests.has(tabId);
};

const startRequestTracking = (tabId, type) => {
  if (typeof tabId !== "number") {
    return false;
  }
  activeRequests.set(tabId, {
    type,
    startedAt: Date.now(),
  });
  return true;
};

const finishRequestTracking = (tabId, type) => {
  if (typeof tabId !== "number") {
    return;
  }

  const current = activeRequests.get(tabId);
  if (!current) {
    return;
  }

  if (!type || !current.type || current.type === type) {
    activeRequests.delete(tabId);
  }
};

const notifyRequestInProgress = (tabId) => {
  if (typeof tabId !== "number") {
    return;
  }

  sendMessageToTab(tabId, {
    type: "SHOW_REQUEST_IN_PROGRESS",
    data: {
      message: "이미 요청중인 작업이 있습니다.",
    },
  });
};

chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeRequests.has(tabId)) {
    activeRequests.delete(tabId);
  }
});

const buildShareUrl = (recordId) => {
  if (!recordId) {
    return null;
  }

  try {
    const shareUrl = new URL(SHARE_BASE_URL);
    shareUrl.searchParams.set("id", recordId);
    return shareUrl.toString();
  } catch (error) {
    console.warn("Failed to construct share URL:", error);
    return null;
  }
};

const isLocalDevelopmentUrl = (targetUrl) => {
  if (!targetUrl || typeof targetUrl !== "string") {
    return false;
  }

  try {
    const parsed = new URL(targetUrl);
    const { protocol, hostname } = parsed;

    if (protocol === "chrome-extension:" || protocol === "chrome:") {
      return true;
    }

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".local")
    );
  } catch (error) {
    console.warn(
      "Failed to parse URL while checking localhost:",
      targetUrl,
      error
    );
    return false;
  }
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

  const tabId = typeof tab?.id === "number" ? tab.id : null;
  if (tabId === null) {
    console.error("No tab ID found for text fact check");
    return;
  }

  if (isRequestInProgress(tabId)) {
    notifyRequestInProgress(tabId);
    return;
  }

  console.log("========== Text Fact Check Request ==========");
  console.log("Request Body:", JSON.stringify({ text: selectedText }, null, 2));
  console.log("==============================================");

  const trackingStarted = startRequestTracking(tabId, "text");

  sendMessageToTab(tabId, {
    type: "SHOW_LOADING",
    data: {
      message: "요청한 작업을 처리중입니다",
    },
  });

  try {
    const response = await fetchFactCheckAPI(selectedText);

    console.log("========== Text Fact Check Response ==========");
    console.log("Response Body:", JSON.stringify(response, null, 2));
    console.log("==============================================");

    const shareUrl = buildShareUrl(response.record_id);

    sendMessageToTab(tabId, {
      type: "SHOW_RESULT_MODAL",
      data: {
        result: response.result,
        accuracyReason:
          response.result?.accuracy_reason || response.accuracy_reason || "",
        recordId: response.record_id,
        shareUrl,
        createdAt: response.created_at,
        inputText: response.input_text,
      },
    });
  } catch (error) {
    console.error("========== Text Fact Check Error ==========");
    console.error("Error:", error);
    console.error("==========================================");

    const messageIncludes = (text) =>
      typeof error?.message === "string" && error.message.includes(text);

    const isApiUrlError =
      messageIncludes("API URL") ||
      messageIncludes("API 서버에 연결할 수 없습니다") ||
      messageIncludes("Failed to fetch") ||
      messageIncludes("NetworkError");

    if (isApiUrlError) {
      sendMessageToTab(tabId, {
        type: "SHOW_API_URL_WARNING",
        data: {
          message:
            "팩트 체크 API 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
        },
      });
    } else {
      sendMessageToTab(tabId, {
        type: "SHOW_ERROR",
        data: {
          message: "팩트 체크 요청 중 오류가 발생했습니다.",
          error: error.message,
        },
      });
    }
  } finally {
    if (trackingStarted) {
      finishRequestTracking(tabId, "text");
    }
  }
};

// API 요청 함수
const fetchFactCheckAPI = async (text) => {
  const url = new URL("/verify/text", API_BASE_URL).toString();
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
        `API 서버에 연결할 수 없습니다.\n\n가능한 원인:\n1. 서버가 실행 중인지 확인해주세요\n2. 네트워크 연결 상태를 확인해주세요\n3. CORS 설정이 올바른지 확인해주세요`
      );
    }

    // 이미 처리된 에러는 그대로 전달
    throw error;
  }
};

const fetchImageFactCheckAPI = async (imageUrl) => {
  const url = new URL("/verify/image-gemini", API_BASE_URL).toString();
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
          `이미지 팩트 체크 API 서버가 HTML을 반환했습니다.\n요청 URL: ${url}\n응답 상태: ${response.status}`
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

      if (response.status === 415) {
        const unsupportedError = new Error("UNSUPPORTED_IMAGE_TYPE");
        unsupportedError.code = "UNSUPPORTED_IMAGE_TYPE";
        unsupportedError.status = response.status;
        unsupportedError.responseBody = errorText;
        throw unsupportedError;
      }

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
        `이미지 팩트 체크 API 서버에 연결할 수 없습니다.\n\n가능한 원인:\n1. 서버가 실행 중인지 확인해주세요\n2. 네트워크 연결 상태를 확인해주세요\n3. CORS 설정이 올바른지 확인해주세요`
      );
    }

    throw error;
  }
};

const buildVideoVerificationUrl = () => {
  return new URL("/verify/video", API_BASE_URL).toString();
};

const fetchVideoFactCheckAPI = async (contentUrl) => {
  const endpointUrl = buildVideoVerificationUrl();
  const requestBody = { url: contentUrl };

  console.log("========== Video API Request ==========");
  console.log("URL:", endpointUrl);
  console.log("Method: POST");
  console.log("Request Body:", JSON.stringify(requestBody, null, 2));
  console.log("=======================================");

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Video API Response Status:", response.status);
    console.log(
      "Video API Response Headers:",
      response.headers.get("content-type")
    );

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const textResponse = await response.text();
      console.error(
        "Video API Non-JSON response received:",
        textResponse.substring(0, 500)
      );

      if (response.status === 404) {
        throw new Error(
          `비디오 팩트 체크 API 엔드포인트를 찾을 수 없습니다. URL을 확인해주세요: ${endpointUrl}`
        );
      } else if (response.status === 0 || response.status === 500) {
        throw new Error(
          `비디오 팩트 체크 서버 오류가 발생했습니다. API 서버가 정상적으로 작동하는지 확인해주세요.`
        );
      } else if (
        textResponse.includes("<!doctype") ||
        textResponse.includes("<!DOCTYPE")
      ) {
        throw new Error(
          `비디오 팩트 체크 API 서버가 HTML을 반환했습니다. API URL이 올바른지 확인해주세요.\n요청 URL: ${endpointUrl}\n응답 상태: ${response.status}`
        );
      } else {
        throw new Error(
          `예상치 못한 비디오 API 응답 형식입니다. (Content-Type: ${contentType})`
        );
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("========== Video API Error Response ==========");
      console.error("Status:", response.status);
      console.error("Status Text:", response.statusText);
      console.error("Error Body:", errorText);
      console.error("================================================");

      if (response.status === 422) {
        const contentForbiddenError = new Error(
          "금지된 컨텐츠라 요청을 수행할 수 없습니다."
        );
        contentForbiddenError.code = "VIDEO_CONTENT_FORBIDDEN";
        contentForbiddenError.status = response.status;
        contentForbiddenError.responseBody = errorText;
        throw contentForbiddenError;
      }

      if (response.status === 403) {
        const forbiddenError = new Error(
          "영상 다운로드 과정중 문제가 발생했습니다. 잠시후 다시 시도해주세요."
        );
        forbiddenError.code = "VIDEO_DOWNLOAD_FORBIDDEN";
        forbiddenError.status = response.status;
        forbiddenError.responseBody = errorText;
        throw forbiddenError;
      }
      throw new Error(
        `비디오 팩트 체크 API 요청 실패 (${response.status}): ${response.statusText}`
      );
    }

    const jsonData = await response.json();
    console.log("========== Video API Response ==========");
    console.log("Response Body:", JSON.stringify(jsonData, null, 2));
    console.log("========================================");
    return jsonData;
  } catch (error) {
    console.error("========== Video API Request Error ==========");
    console.error("Error:", error);
    console.error("=============================================");

    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError")
    ) {
      throw new Error(
        `비디오 팩트 체크 API 서버에 연결할 수 없습니다.\n\n가능한 원인:\n1. 서버가 실행 중인지 확인해주세요\n2. 네트워크 연결 상태를 확인해주세요\n3. CORS 설정이 올바른지 확인해주세요`
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

  const tabId = typeof tab?.id === "number" ? tab.id : null;
  if (tabId === null) {
    console.error("No tab ID found for image fact check");
    return;
  }

  if (isRequestInProgress(tabId)) {
    notifyRequestInProgress(tabId);
    return;
  }

  console.log("========== Image Fact Check Request ==========");
  console.log("Image URL:", imageUrl);
  console.log("==============================================");

  const trackingStarted = startRequestTracking(tabId, "image");

  sendMessageToTab(tabId, {
    type: "SHOW_LOADING",
    data: {
      message: "요청한 작업을 처리중입니다",
    },
  });

  try {
    const response = await fetchImageFactCheckAPI(imageUrl);

    console.log("========== Image Fact Check API Response ==========");
    console.log("Response Body:", JSON.stringify(response, null, 2));
    console.log("===================================================");

    const payload = {
      imageUrl,
      result: response.result,
    };

    sendMessageToTab(tabId, {
      type: "SHOW_IMAGE_RESULT_MODAL",
      data: payload,
    });
  } catch (error) {
    console.error("========== Image Fact Check Error ==========");
    console.error("Error:", error);
    console.error("Error Message:", error.message);
    console.error("============================================");

    const isUnsupportedImageType =
      error?.code === "UNSUPPORTED_IMAGE_TYPE" ||
      error?.message === "UNSUPPORTED_IMAGE_TYPE";

    if (isUnsupportedImageType) {
      sendMessageToTab(tabId, {
        type: "SHOW_ERROR",
        data: {
          message: "지원되지 않는 이미지 유형입니다.",
        },
      });
      return;
    }

    const messageIncludes = (text) =>
      typeof error?.message === "string" && error.message.includes(text);

    const isApiUrlError =
      messageIncludes("API URL") ||
      messageIncludes("API 서버에 연결할 수 없습니다") ||
      messageIncludes("Failed to fetch") ||
      messageIncludes("NetworkError");

    if (isApiUrlError) {
      sendMessageToTab(tabId, {
        type: "SHOW_API_URL_WARNING",
        data: {
          message:
            "팩트 체크 API 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
        },
      });
    } else {
      sendMessageToTab(tabId, {
        type: "SHOW_ERROR",
        data: {
          message: "이미지 팩트 체크 요청 중 오류가 발생했습니다.",
          error: error.message,
        },
      });
    }
  } finally {
    if (trackingStarted) {
      finishRequestTracking(tabId, "image");
    }
  }
};

const handleVideoFactCheck = async (contentUrl, platform, tabId) => {
  if (!contentUrl) {
    throw new Error("영상 URL이 존재하지 않습니다.");
  }

  try {
    const response = await fetchVideoFactCheckAPI(contentUrl);

    const payload = {
      platform,
      requestedUrl: contentUrl,
      fftArtifactScore: response.fft_artifact_score ?? "",
      actionPatternScore: response.action_pattern_score ?? "",
      result: response.result ?? "",
      transcript:
        typeof response.transcript === "string" ? response.transcript : null,
      transcriptSrt:
        typeof response.transcript_srt === "string"
          ? response.transcript_srt
          : null,
      factCheck:
        response.fact_check && typeof response.fact_check === "object"
          ? response.fact_check
          : null,
      cached:
        typeof response.cached === "boolean" ? response.cached : null,
      recordId:
        typeof response.record_id === "string" && response.record_id.length > 0
          ? response.record_id
          : null,
      videoId:
        typeof response.video_id === "string" && response.video_id.length > 0
          ? response.video_id
          : null,
      duration:
        typeof response.duration === "number" &&
        Number.isFinite(response.duration)
          ? response.duration
          : null,
      rawResponse: response,
    };

    sendMessageToTab(tabId, {
      type: "SHOW_VIDEO_RESULT_MODAL",
      data: payload,
    });

    return payload;
  } catch (error) {
    console.error("Video fact check failed:", error);

    const errorMessage =
      typeof error?.message === "string" ? error.message : "";

    const isContentForbidden =
      error?.code === "VIDEO_CONTENT_FORBIDDEN" || error?.status === 422;

    const isForbidden =
      error?.code === "VIDEO_DOWNLOAD_FORBIDDEN" || error?.status === 403;

    const isApiUrlError =
      errorMessage.includes("API URL") ||
      errorMessage.includes("API 서버에 연결할 수 없습니다") ||
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError");

    if (isContentForbidden) {
      sendMessageToTab(tabId, {
        type: "SHOW_ERROR",
        data: {
          message: "금지된 컨텐츠라 요청을 수행할 수 없습니다.",
        },
      });
    } else if (isForbidden) {
      sendMessageToTab(tabId, {
        type: "SHOW_ERROR",
        data: {
          message:
            "영상 다운로드 과정중 문제가 발생했습니다. 잠시후 다시 시도해주세요.",
        },
      });
    } else if (isApiUrlError) {
      sendMessageToTab(tabId, {
        type: "SHOW_API_URL_WARNING",
        data: {
          message:
            "팩트 체크 API 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
        },
      });
    } else {
      sendMessageToTab(tabId, {
        type: "SHOW_ERROR",
        data: {
          message: "영상 팩트 체크 요청 중 오류가 발생했습니다.",
          error: error.message,
        },
      });
    }

    throw error;
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

  if (isLocalDevelopmentUrl(url)) {
    console.log("Auto fact check skipped: running on localhost URL", url);
    return { skipped: true, reason: "localhost_url" };
  }

  console.log("========== Starting API Request ==========");
  console.log("API Base URL:", API_BASE_URL);
  console.log("Text length:", text.length);
  console.log("===========================================");

  try {
    // API 요청 전송
    const response = await fetchFactCheckAPI(text);

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
            "팩트 체크 API 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
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
    chrome.storage.sync.set({ isBackgroundDetectionEnabled: enabled }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Failed to persist background detection toggle:",
          chrome.runtime.lastError.message
        );
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message,
        });
        return;
      }

      sendResponse({ success: true, enabled });
    });
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
    const tabId =
      typeof sender.tab?.id === "number" ? sender.tab.id : null;
    if (tabId === null) {
      console.error("No tab ID found for video fact check");
      sendResponse({ success: false, error: "Tab ID not found" });
      return;
    }

    if (isRequestInProgress(tabId)) {
      notifyRequestInProgress(tabId);
      sendResponse({ success: false, error: "request_in_progress" });
      return;
    }

    const { url, platform } = request.data || {};
    const trackingStarted = startRequestTracking(tabId, "video");

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
      })
      .finally(() => {
        if (trackingStarted) {
          finishRequestTracking(tabId, "video");
        }
      });

    return true;
  }
});
