import { useState, useEffect } from "react";

export interface CurrencyRate {
  symbol: string;
  currentRate: number;
  history: number[];
}

export interface CurrencyData {
  baseCurrency: string;
  updatedAt: string;
  dates: string[];
  rates: CurrencyRate[];
}

export function useCurrencyData() {
  const [currencyData, setCurrencyData] = useState<CurrencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/currency-data");
        if (!res.ok) {
          throw new Error(`Currency API error: ${res.statusText}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setCurrencyData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchData();

    const interval = setInterval(fetchData, 60 * 60 * 1000); // Update every hour

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { currencyData, loading, error };
}
