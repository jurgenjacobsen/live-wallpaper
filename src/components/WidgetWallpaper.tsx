import { useEffect, useRef, useState } from "react";
import type { RuntimeConfig } from "../api/plane";
import { useWeatherData } from "../hooks/useWeatherData";
import { CurrencyWidget } from "./CurrencyWidget";

interface WidgetWallpaperProps {
  runtimeConfig: RuntimeConfig;
  onInitialDataReady?: () => void;
}

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

function widgetCornerStyle(corner: RuntimeConfig["weather"]["corner"]): React.CSSProperties {
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

function getFltCatColor(fltCat?: string): { bg: string; text: string } {
  switch (fltCat?.toUpperCase()) {
    case "VFR":
      return { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399" };
    case "MVFR":
      return { bg: "rgba(59, 130, 246, 0.15)", text: "#60a5fa" };
    case "IFR":
      return { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171" };
    case "LIFR":
      return { bg: "rgba(236, 72, 153, 0.15)", text: "#f472b6" };
    default:
      return { bg: "rgba(148, 163, 184, 0.15)", text: "#cbd5e1" };
  }
}

export function WeatherWidget({ runtimeConfig, onInitialDataReady }: { runtimeConfig: RuntimeConfig; onInitialDataReady?: () => void }) {
  const { weather, aviationWeather, loading, error } = useWeatherData({
    enableMetar: runtimeConfig.weather.enableMetar,
    enableTaf: runtimeConfig.weather.enableTaf,
    airports: runtimeConfig.weather.airports,
  });
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!loading && !notifiedRef.current) {
      notifiedRef.current = true;
      setTimeout(() => {
        onInitialDataReady?.();
      }, 500);
    }
  }, [loading, onInitialDataReady]);

  if (loading) return <p style={{ margin: 0 }}>Loading weather…</p>;
  if (error) return <p style={{ margin: 0, color: "#fecaca" }}>{error}</p>;
  if (!weather) return <p style={{ margin: 0 }}>No weather data available.</p>;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: "0 0 2px", fontSize: "22px", lineHeight: 1.2 }}>{weather.city}</h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#bfdbfe", textTransform: "capitalize" }}>{weather.current.description}</p>
          <p style={{ margin: "0px 0 0", fontSize: "11px", color: "#94a3b8" }}>
            Last updated on {formatUpdatedAtLabel(weather.updatedAt)}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ fontSize: "34px", lineHeight: 1, fontWeight: 700 }}>{weather.current.tempC}°C</div>
            {weather.current.iconUrl ? (
              <img
                src={weather.current.iconUrl}
                alt={weather.current.condition}
                style={{ width: "48px", height: "48px", objectFit: "contain" }}
              />
            ) : null}
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1" }}>
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

      {aviationWeather && aviationWeather.length > 0 && (
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {aviationWeather.map((data) => {
            const hasMetar = runtimeConfig.weather.enableMetar && data.rawOb;
            const hasTaf = runtimeConfig.weather.enableTaf && data.rawTaf;
            if (!hasMetar && !hasTaf) return null;

            const fltCatColor = getFltCatColor(data.fltCat);

            return (
              <div
                key={data.icaoId}
                style={{
                  borderRadius: "10px",
                  padding: "8px 10px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700 }}>
                    {data.icaoId}
                  </span>
                  {data.fltCat && (
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: "4px",
                        background: fltCatColor.bg,
                        color: fltCatColor.text,
                        border: `1px solid ${fltCatColor.text}33`,
                      }}
                    >
                      {data.fltCat}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {hasMetar && (
                    <div style={{ display: "flex", gap: "4px", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "9px", fontWeight: 700, color: "#94a3b8", width: "42px", marginTop: "2px", flexShrink: 0 }}>METAR</span>
                      <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#e2e8f0", wordBreak: "break-all", lineHeight: 1.3 }}>
                        {data.rawOb}
                      </span>
                    </div>
                  )}
                  {hasTaf && (
                    <div style={{ display: "flex", gap: "4px", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "9px", fontWeight: 700, color: "#94a3b8", width: "42px", marginTop: "2px", flexShrink: 0 }}>TAF</span>
                      <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#cbd5e1", wordBreak: "break-all", lineHeight: 1.3 }}>
                        {data.rawTaf}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function WidgetWallpaper({ runtimeConfig, onInitialDataReady }: WidgetWallpaperProps) {
  const bgUrl = runtimeConfig.weather.backgroundImageUrl;
  const hasBg = !!bgUrl;
  const hasWeather = runtimeConfig.providers.includes("weather");
  const hasCurrency = runtimeConfig.providers.includes("currency");

  const [bgLoaded, setBgLoaded] = useState(!hasBg);
  const [weatherLoaded, setWeatherLoaded] = useState(!hasWeather);
  const [currencyLoaded, setCurrencyLoaded] = useState(!hasCurrency);

  // Preload and decode background image
  useEffect(() => {
    if (!hasBg) {
      setBgLoaded(true);
      return;
    }

    setBgLoaded(false);
    const img = new Image();
    img.src = bgUrl;
    img.onload = () => {
      if ('decode' in img) {
        img.decode()
          .then(() => {
            setBgLoaded(true);
          })
          .catch((err) => {
            console.error("Failed to decode background image:", err);
            setBgLoaded(true);
          });
      } else {
        setBgLoaded(true);
      }
    };
    img.onerror = (err) => {
      console.error("Failed to load background image:", err);
      setBgLoaded(true);
    };
  }, [bgUrl, hasBg]);

  // Coordinate readiness of all components
  const allReady = bgLoaded && weatherLoaded && currencyLoaded;
  const notifiedReadyRef = useRef(false);

  useEffect(() => {
    if (allReady && !notifiedReadyRef.current) {
      notifiedReadyRef.current = true;
      onInitialDataReady?.();
    }
  }, [allReady, onInitialDataReady]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        backgroundImage: (hasBg && bgLoaded)
          ? `url(${bgUrl})`
          : "linear-gradient(135deg, #0f172a, #1e3a8a)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        opacity: allReady ? 1 : 0,
        transition: "opacity 150ms ease-in-out",
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
          ...widgetCornerStyle(runtimeConfig.weather.corner),
          width: "min(520px, calc(100vw - 48px))",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          zIndex: 2,
        }}
      >
        {hasWeather && (
          <div
            style={{
              padding: "12px",
              borderRadius: "14px",
              backdropFilter: "blur(10px)",
              background: "rgba(2, 6, 23, 0.44)",
              border: "1px solid rgba(148, 163, 184, 0.35)",
              color: "#e2e8f0",
            }}
          >
            <WeatherWidget runtimeConfig={runtimeConfig} onInitialDataReady={() => setWeatherLoaded(true)} />
          </div>
        )}

        {hasCurrency && (
          <div
            style={{
              padding: "12px",
              borderRadius: "14px",
              backdropFilter: "blur(10px)",
              background: "rgba(2, 6, 23, 0.44)",
              border: "1px solid rgba(148, 163, 184, 0.35)",
              color: "#e2e8f0",
            }}
          >
            <CurrencyWidget onInitialDataReady={() => setCurrencyLoaded(true)} />
          </div>
        )}
      </div>
    </div>
  );
}
