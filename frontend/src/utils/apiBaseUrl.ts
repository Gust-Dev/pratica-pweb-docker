const normalizeBaseUrl = (value: string) => value.replace(/\/$/, "");

const computeBaseUrl = () => {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!fromEnv) {
    return normalizeBaseUrl("/api");
  }

  if (typeof window !== "undefined") {
    const currentPort = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
    if (fromEnv.includes("localhost:3000") && currentPort !== "3000") {
      return normalizeBaseUrl("/api");
    }
  }

  return normalizeBaseUrl(fromEnv);
};

export const API_BASE_URL = computeBaseUrl();
