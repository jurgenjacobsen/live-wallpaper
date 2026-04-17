import type { RuntimeConfig } from "../api/plane";
import { useWeatherData } from "../hooks/useWeatherData";

function formatUpdatedAtLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function weatherCornerStyle(corner: RuntimeConfig["weather"]["corner"]): React.CSSProperties {
  const horizontalSpacing = "24px";
  const topSpacing = "100px";
  const bottomSpacing = "50px";
  switch (corner) {
    case "top-left":
      return { top: topSpacing, left: horizontalSpacing };
    case "top-right":
      return { top: topSpacing, right: horizontalSpacing };
    case "bottom-left":
      return { bottom: bottomSpacing, left: horizontalSpacing };
    case "bottom-right":
      return { bottom: bottomSpacing, right: horizontalSpacing };
    default:
      return { top: topSpacing, right: horizontalSpacing };
  }
}

export function WeatherWallpaper({ runtimeConfig }: { runtimeConfig: RuntimeConfig }) {
  const { weather, loading, error } = useWeatherData();

  return (
    <div
      style={{
        width: "1920px",
        height: "1080px",
        position: "relative",
        overflow: "hidden",
        backgroundImage: runtimeConfig.weather.backgroundImageUrl
          ? `url(${runtimeConfig.weather.backgroundImageUrl})`
          : "linear-gradient(135deg, #0f172a, #1e3a8a)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.22))",
        }}
      />

      <div
        style={{
          position: "absolute",
          ...weatherCornerStyle(runtimeConfig.weather.corner),
          width: "520px",
          padding: "12px",
          borderRadius: "14px",
          backdropFilter: "blur(10px)",
          background: "rgba(2, 6, 23, 0.44)",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          color: "#e2e8f0",
          zIndex: 2,
        }}
      >
        {loading ? (
          <p style={{ margin: 0 }}>Loading weather…</p>
        ) : error ? (
          <p style={{ margin: 0, color: "#fecaca" }}>{error}</p>
        ) : weather ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: "0 0 2px", fontSize: "22px", lineHeight: 1.2 }}>{weather.city}</h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#bfdbfe", textTransform: "capitalize" }}>{weather.current.description}</p>
                <p style={{ margin: "0px 0 0", fontSize: "11px", color: "#94a3b8" }}>
                  Last updated on {formatUpdatedAtLabel(weather.updatedAt)}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "34px", lineHeight: 1, fontWeight: 700 }}>{weather.current.tempC}°C</div>
                <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#cbd5e1" }}>
                  Humidity {weather.current.humidity}% | Wind {weather.current.windKph} km/h
                </p>
                
              </div>
            </div>

            <div
              style={{
                marginTop: "10px",
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: "6px",
              }}
            >
              {weather.days.slice(0, 5).map((day) => (
                <div
                  key={day.dateKey}
                  style={{
                    borderRadius: "10px",
                    padding: "8px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "#cbd5e1" }}>{day.dateLabel}</div>
                  {day.iconUrl ? (
                    <img
                      src={day.iconUrl}
                      alt={day.condition}
                      style={{ width: "34px", height: "34px", objectFit: "contain" }}
                    />
                  ) : null}
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>{day.maxC}° / {day.minC}°</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={{ margin: 0 }}>No weather data available.</p>
        )}
      </div>
    </div>
  );
}
