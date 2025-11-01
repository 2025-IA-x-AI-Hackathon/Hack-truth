import { useEffect, useMemo, useState } from 'react';
import ShareResult from './components/ShareResult.jsx';
import { useQueryParam } from './hooks/useQueryParam.js';
import { normalizeSharePayload } from './utils/resultNormalizer.js';

const buildShareRequestUrl = (shareId) => {
  const baseUrlRaw = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrlRaw) {
    throw new Error('환경 변수 VITE_API_BASE_URL이 설정되지 않았습니다.');
  }

  const endpointRaw = import.meta.env.VITE_SHARE_ENDPOINT;
  const endpoint =
    typeof endpointRaw === 'string' && endpointRaw.trim().length > 0
      ? endpointRaw.trim()
      : '/verify/text/:record_id';

  let base;
  try {
    base = new URL(baseUrlRaw);
  } catch (error) {
    throw new Error('VITE_API_BASE_URL이 올바른 절대 URL 형태인지 확인해주세요.');
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (normalizedEndpoint.includes(':record_id')) {
    const replaced = normalizedEndpoint.replace(':record_id', encodeURIComponent(shareId));
    return new URL(replaced, base).toString();
  }

  if (normalizedEndpoint.includes(':id')) {
    const replaced = normalizedEndpoint.replace(':id', encodeURIComponent(shareId));
    return new URL(replaced, base).toString();
  }

  const sanitizedEndpoint = normalizedEndpoint.replace(/\/+$/, '');
  const pathWithId = `${sanitizedEndpoint}/${encodeURIComponent(shareId)}`;
  const finalPath = pathWithId.startsWith('/') ? pathWithId : `/${pathWithId}`;
  return new URL(finalPath, base).toString();
};

const App = () => {
  const shareId = useQueryParam('id');
  const [state, setState] = useState({
    status: 'idle',
    data: null,
    error: null,
  });

  const canFetch = useMemo(() => Boolean(shareId), [shareId]);

  useEffect(() => {
    if (!canFetch) {
      console.warn('[ShareResult] query param "id"가 비어 있습니다.');
      const message = '공유 링크에서 record_id 값을 확인할 수 없습니다.';
      setState((prev) => {
        if (prev.status === 'error' && prev.error === message) {
          return prev;
        }
        return {
          status: 'error',
          data: null,
          error: message,
        };
      });
      return;
    }

    const controller = new AbortController();

    const fetchData = async () => {
      console.groupCollapsed('[ShareResult] 공유 결과 요청 시작');
      console.log('[ShareResult] shareId:', shareId);
      setState({ status: 'loading', data: null, error: null });

      try {
        const requestUrl = buildShareRequestUrl(shareId);
        console.log('[ShareResult] 요청 URL:', requestUrl);
        const response = await fetch(requestUrl, { signal: controller.signal });
        const rawBody = await response.text();
        console.log('[ShareResult] 응답 상태:', response.status);
        console.log('[ShareResult] 응답 헤더:', Object.fromEntries(response.headers.entries()));
        console.log('[ShareResult] 응답 Raw Body 미리보기:', rawBody.trim().slice(0, 200));

        if (!response.ok) {
          const preview = rawBody.trim().slice(0, 200) || '응답 본문이 비어 있습니다.';
          throw new Error(
            [
              `서버 요청이 실패했습니다. (status: ${response.status})`,
              `요청 URL: ${requestUrl}`,
              `응답 미리보기: ${preview}`,
            ].join('\n'),
          );
        }

        let payload;
        try {
          payload = rawBody ? JSON.parse(rawBody) : null;
          console.log('[ShareResult] 파싱된 JSON:', payload);
        } catch (parseError) {
          const preview = rawBody.trim().slice(0, 200) || '응답 본문이 비어 있습니다.';
          const looksLikeHtml = preview.toLowerCase().includes('<!doctype') || preview.toLowerCase().includes('<html');
          const hint = looksLikeHtml
            ? '\n힌트: API Base URL이 프런트엔드 주소로 설정되어 있거나, 프록시 설정이 누락된 것 같습니다.'
            : '';
          throw new Error(
            [
              'JSON 형식의 응답을 기대했지만 다른 형식이 반환되었습니다.',
              `요청 URL: ${requestUrl}`,
              `응답 미리보기: ${preview}`,
              hint,
            ].join('\n'),
          );
        }

        const normalized = normalizeSharePayload(payload);
        console.log('[ShareResult] 정규화된 데이터:', normalized);

        if (!normalized) {
          throw new Error('응답 데이터를 해석할 수 없습니다.');
        }

        const enriched = {
          ...normalized,
          id: normalized.id || shareId,
        };

        console.log('[ShareResult] 상태 업데이트 데이터:', enriched);
        setState({ status: 'success', data: enriched, error: null });
        console.groupEnd();
      } catch (error) {
        console.error('[ShareResult] 요청 처리 중 오류:', error);
        if (error.name === 'AbortError') {
          console.log('[ShareResult] 요청이 Abort 되었습니다.');
          console.groupEnd();
          return;
        }

        setState({
          status: 'error',
          data: null,
          error: error.message || '결과를 불러오는 중 오류가 발생했습니다.',
        });
        console.groupEnd();
      }
    };

    fetchData();

    return () => controller.abort();
  }, [canFetch, shareId]);

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <span className="app-shell__brand">HackTruth</span>
        <span className="app-shell__subtitle">Fact Check Result</span>
      </header>

      <main className="app-shell__main">
        {state.status === 'loading' && (
          <section className="app-state">
            <div className="spinner" aria-hidden="true" />
            <p>결과를 불러오는 중입니다...</p>
          </section>
        )}

        {state.status === 'error' && (
          <section className="app-state app-state--error">
            <h2>결과를 가져오지 못했어요</h2>
            <p>{state.error}</p>
            <p className="app-state__hint">
              링크가 올바른지 또는 잠시 후 다시 시도해주세요.
            </p>
          </section>
        )}

        {state.status === 'success' && state.data && (
          <ShareResult data={state.data} />
        )}
      </main>

      <footer className="app-shell__footer">
        <p>HackTruth © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default App;
