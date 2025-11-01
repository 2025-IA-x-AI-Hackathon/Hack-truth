const ShareResult = ({ data }) => {
  const {
    accuracy,
    accuracyReason,
    reason,
    urls,
    createdAt,
    inputText,
  } = data;

  const createdAtText = createdAt ? new Date(createdAt).toLocaleString() : null;
  const references = Array.isArray(urls) ? urls : [];

  return (
    <section className="share-result">
      <header className="share-result__header">
        <div className="share-result__badge">
          <span className="share-result__badge-label">정확도</span>
          <span className="share-result__badge-value">{accuracy || '--'}</span>
        </div>
        {accuracyReason && (
          <p className="share-result__accuracy-reason">{accuracyReason}</p>
        )}
        {createdAtText && (
          <div className="share-result__meta">
            <span>
              <strong>분석일</strong>
              {createdAtText}
            </span>
          </div>
        )}
      </header>

      <section className="share-result__section">
        <h3 className="share-result__section-title">분석 결과</h3>
        <p className="share-result__reason">
          {reason || '분석 결과를 불러오지 못했습니다.'}
        </p>
      </section>

      {inputText && (
        <section className="share-result__section">
          <h3 className="share-result__section-title">검증한 텍스트</h3>
          <blockquote className="share-result__input-text">{inputText}</blockquote>
        </section>
      )}

      {references.length > 0 && (
        <section className="share-result__section">
          <h3 className="share-result__section-title">참고 레퍼런스</h3>
          <ul className="share-result__references">
            {references.map((url, index) => (
              <li key={`${url}-${index}`}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

    </section>
  );
};

export default ShareResult;
