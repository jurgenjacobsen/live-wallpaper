import { useCurrencyData } from "../hooks/useCurrencyData";

interface EnhancedGraphProps {
  data: number[];
  dates: string[];
  symbol: string;
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { weekday: 'short',day: "2-digit" }) + "th";
}

function EnhancedGraph({ data, dates, symbol }: EnhancedGraphProps) {
  if (data.length < 2) return <div style={{ height: 80, display: 'grid', placeItems: 'center', color: '#64748b', fontSize: 10 }}>Insufficient data</div>;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = range * 0.15;
  const adjMin = min - padding;
  const adjMax = max + padding;
  const adjRange = adjMax - adjMin;

  const width = 300; // Made it wider
  const height = 80; // Slightly taller
  const margin = { top: 15, right: 10, bottom: 25, left: 10 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const points = data
    .map((val, i) => {
      const x = margin.left + (i / (data.length - 1)) * chartWidth;
      const y = margin.top + (chartHeight - ((val - adjMin) / adjRange) * chartHeight);
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `${points} ${margin.left + chartWidth},${margin.top + chartHeight} ${margin.left},${margin.top + chartHeight}`;

  const isUp = data[data.length - 1] >= data[0];
  const color = isUp ? "#10b981" : "#f43f5e";

  return (
    <div style={{ position: 'relative', width, height }}>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1={margin.left} y1={margin.top} x2={margin.left + chartWidth} y2={margin.top} stroke="rgba(148, 163, 184, 0.1)" strokeWidth="1" />
        <line x1={margin.left} y1={margin.top + chartHeight} x2={margin.left + chartWidth} y2={margin.top + chartHeight} stroke="rgba(148, 163, 184, 0.1)" strokeWidth="1" />

        {/* Area fill */}
        <polyline fill={`url(#grad-${symbol})`} points={areaPoints} />

        {/* Main line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />

        {/* Data points */}
        {data.map((val, i) => {
          const x = margin.left + (i / (data.length - 1)) * chartWidth;
          const y = margin.top + (chartHeight - ((val - adjMin) / adjRange) * chartHeight);
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}

        {/* Price Labels (Min/Max) */}
        <text x={margin.left} y={margin.top - 4} fontSize="9" fill="#94a3b8" fontWeight="600">{max.toFixed(4)}</text>
        <text x={margin.left} y={margin.top + chartHeight + 10} fontSize="9" fill="#94a3b8" fontWeight="600">{min.toFixed(4)}</text>

        {/* Day Labels */}
        {dates.map((date, i) => {
          const x = margin.left + (i / (dates.length - 1)) * chartWidth;
          return (
            <text
              key={i}
              x={x}
              y={height}
              fontSize="9"
              fill="#64748b"
              textAnchor={i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"}
              fontWeight="500"
            >
              {formatDayLabel(date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function CurrencyWidget() {
  const { currencyData, loading, error } = useCurrencyData();

  if (loading) return <div style={{ padding: "12px", fontSize: "13px", color: "#94a3b8" }}>Loading currency…</div>;
  if (error) return <div style={{ padding: "12px", fontSize: "13px", color: "#fecaca" }}>{error}</div>;
  if (!currencyData) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ padding: "0 4px", display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Currency Market</span>
        <span style={{ fontSize: '10px', color: '#64748b' }}>Base: {currencyData.baseCurrency}</span>
      </div>
      
      {currencyData.rates.map((rate) => {
        const first = rate.history[0];
        const last = rate.currentRate;
        const diff = last - first;
        const percent = (diff / first) * 100;
        const isUp = diff >= 0;

        return (
          <div
            key={rate.symbol}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(15, 23, 42, 0.45)",
              padding: "16px",
              borderRadius: "16px",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div style={{ flex: '0 0 120px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9" }}>{rate.symbol}</span>
                <span style={{ 
                  fontSize: "11px", 
                  fontWeight: 600, 
                  color: isUp ? "#10b981" : "#f43f5e",
                  background: isUp ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.1)",
                  padding: "2px 6px",
                  borderRadius: "6px"
                }}>
                  {isUp ? "↑" : "↓"} {Math.abs(percent).toFixed(2)}%
                </span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#ffffff", letterSpacing: '-0.02em' }}>
                {rate.currentRate.toFixed(4)}
              </div>
              <div style={{ fontSize: "10px", color: "#64748b", marginTop: '4px' }}>
                1 {currencyData.baseCurrency} = {rate.currentRate.toFixed(4)} {rate.symbol}
              </div>
            </div>
            
            <div style={{ marginLeft: "20px" }}>
              <EnhancedGraph data={rate.history} dates={currencyData.dates} symbol={rate.symbol} />
            </div>
          </div>
        );
      })}
      
      <div style={{ fontSize: "9px", color: "#94a3b8", textAlign: "right", paddingRight: '4px', fontStyle: 'italic' }}>
        Updated {new Date(currencyData.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
