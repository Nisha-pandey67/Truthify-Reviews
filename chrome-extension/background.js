const DEFAULT_API_BASE_URL = "http://127.0.0.1:5000";
const MAX_SCAN_HISTORY = 12;

async function getSettings() {
  const stored = await chrome.storage.sync.get(["apiBaseUrl", "apiKey", "autoScan", "threshold"]);
  return {
    apiBaseUrl: stored.apiBaseUrl || DEFAULT_API_BASE_URL,
    apiKey: stored.apiKey || "",
    autoScan: Boolean(stored.autoScan),
    threshold: typeof stored.threshold === "number" ? stored.threshold : 0.5
  };
}

async function getScanHistory() {
  const stored = await chrome.storage.local.get(["scanHistory"]);
  return stored.scanHistory || [];
}

async function saveScanHistoryEntry(entry) {
  const history = await getScanHistory();
  const nextHistory = [entry, ...history].slice(0, MAX_SCAN_HISTORY);
  await chrome.storage.local.set({ scanHistory: nextHistory });
  return nextHistory;
}

async function analyzeReviews(reviews, threshold = 0.5) {
  const { apiBaseUrl, apiKey } = await getSettings();
  const headers = {
    "Content-Type": "application/json"
  };

  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  const response = await fetch(`${apiBaseUrl}/predict`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reviews, threshold })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Prediction request failed.");
  }

  return response.json();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_REVIEWS") {
    analyzeReviews(message.reviews, message.threshold)
      .then(async (data) => {
        const history = await saveScanHistoryEntry({
          hostname: message.hostname || "",
          url: message.url || "",
          title: message.title || "",
          createdAt: new Date().toISOString(),
          summary: data.summary,
          analytics: data.analytics || null
        });

        sendResponse({ ok: true, data, history });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_API_BASE_URL") {
    getSettings()
      .then((settings) => sendResponse({ ok: true, ...settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "SET_API_SETTINGS") {
    chrome.storage.sync
      .set({
        apiBaseUrl: message.apiBaseUrl,
        apiKey: message.apiKey || "",
        autoScan: Boolean(message.autoScan),
        threshold: typeof message.threshold === "number" ? message.threshold : 0.5
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_SCAN_HISTORY") {
    getScanHistory()
      .then((history) => sendResponse({ ok: true, history }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
