const toOptionalString = (value) =>
  value === null || value === undefined ? '' : String(value);

export const normalizeSharePayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const result = payload.result && typeof payload.result === 'object' ? payload.result : {};
  const urlsRaw = Array.isArray(result.urls) ? result.urls : [];
  const urls = urlsRaw.filter((url) => typeof url === 'string' && url.trim().length > 0);
  return {
    id: result.id || payload.record_id || payload.id || null,
    accuracy: toOptionalString(result.accuracy),
    accuracyReason: toOptionalString(result.accuracy_reason),
    reason: toOptionalString(result.reason),
    urls,
    createdAt: payload.created_at || null,
    inputText: toOptionalString(payload.input_text),
  };
};
