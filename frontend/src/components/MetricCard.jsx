const formatPercent = (value) => {
  if (value === null || value === undefined) {
    return '--';
  }

  return `${value.toFixed(1)}%`;
};

const MetricCard = ({ label, value, tone = 'neutral' }) => {
  return (
    <div className={`metric-card metric-card--${tone}`}>
      <span className="metric-card__label">{label}</span>
      <span className="metric-card__value">{formatPercent(value)}</span>
    </div>
  );
};

export default MetricCard;
