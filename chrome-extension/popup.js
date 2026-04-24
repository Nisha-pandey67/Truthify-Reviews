async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

let currentAnalysis = null;

function setStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.style.color = isError ? "#b42318" : "#0f172a";
}

function setMetric(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function createDonutChart(fakeCount, genuineCount) {
  const total = Math.max(fakeCount + genuineCount, 1);
  const fakePercent = (fakeCount / total) * 100;
  const circumference = 2 * Math.PI * 42;
  const fakeArc = (fakePercent / 100) * circumference;

  return `
    <svg viewBox="0 0 120 120" aria-label="review pie chart">
      <circle cx="60" cy="60" r="42" fill="none" stroke="#e2e8f0" stroke-width="14"></circle>
      <circle
        cx="60"
        cy="60"
        r="42"
        fill="none"
        stroke="#f97316"
        stroke-width="14"
        stroke-linecap="round"
        stroke-dasharray="${fakeArc} ${circumference - fakeArc}"
        transform="rotate(-90 60 60)"
      ></circle>
      <text x="60" y="56" text-anchor="middle" font-size="11" fill="#64748b">Fake</text>
      <text x="60" y="72" text-anchor="middle" font-size="18" font-weight="700" fill="#0f172a">${fakePercent.toFixed(0)}%</text>
    </svg>
  `;
}

function createTrendChart(points, lineColor, emptyLabel) {
  if (!points?.length) {
    return `<div class="muted">${emptyLabel}</div>`;
  }

  const width = 320;
  const height = 120;
  const padding = 16;
  const maxX = Math.max(points.length - 1, 1);
  const maxY = 100;

  const coordinates = points.map((point, index) => {
    const x = padding + (index / maxX) * (width - padding * 2);
    const y = height - padding - ((point.value || 0) / maxY) * (height - padding * 2);
    return { x, y, label: point.label || "", value: point.value || 0 };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x} ${height - padding} L ${coordinates[0].x} ${height - padding} Z`;

  const pointsMarkup = coordinates
    .map(
      (point) => `
        <circle cx="${point.x}" cy="${point.y}" r="3.5" fill="${lineColor}"></circle>
        <title>${point.label}: ${point.value.toFixed(1)}%</title>
      `
    )
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" aria-label="trend chart">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1"></line>
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1"></line>
      <path d="${areaPath}" fill="rgba(249, 115, 22, 0.12)"></path>
      <path d="${linePath}" fill="none" stroke="${lineColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      ${pointsMarkup}
    </svg>
  `;
}

function renderPieChart(summary) {
  document.getElementById("pieChart").innerHTML = createDonutChart(
    summary.fake_reviews,
    summary.genuine_reviews
  );

  document.getElementById("pieLegend").innerHTML = `
    <div class="legend-item">
      <div class="legend-item">
        <span class="legend-swatch" style="background:#10b981"></span>
        <span>Genuine</span>
      </div>
      <strong>${summary.genuine_reviews}</strong>
    </div>
    <div class="legend-item">
      <div class="legend-item">
        <span class="legend-swatch" style="background:#f97316"></span>
        <span>Fake</span>
      </div>
      <strong>${summary.fake_reviews}</strong>
    </div>
  `;
}

function renderRiskBars(analytics, totalReviews) {
  const risks = analytics?.risk_distribution || { high: 0, medium: 0, low: 0 };
  const palette = {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "#10b981"
  };

  document.getElementById("riskBars").innerHTML = Object.entries(risks)
    .map(([label, count]) => {
      const percentage = totalReviews ? (count / totalReviews) * 100 : 0;
      return `
        <div class="bar-row">
          <span>${label[0].toUpperCase()}${label.slice(1)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${percentage}%; background:${palette[label]}"></div>
          </div>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join("");
}

function renderSentimentBars(analytics, totalReviews) {
  const sentiments = analytics?.sentiment_distribution || {
    positive: 0,
    neutral: 0,
    negative: 0
  };
  const palette = {
    positive: "#10b981",
    neutral: "#64748b",
    negative: "#ef4444"
  };

  document.getElementById("sentimentBars").innerHTML = Object.entries(sentiments)
    .map(([label, count]) => {
      const percentage = totalReviews ? (count / totalReviews) * 100 : 0;
      return `
        <div class="bar-row">
          <span>${label[0].toUpperCase()}${label.slice(1)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${percentage}%; background:${palette[label]}"></div>
          </div>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join("");
}

function renderSimilarityList(analytics) {
  const pairs = analytics?.review_similarity?.top_similar_pairs || [];
  const pairCount = analytics?.review_similarity?.similar_pair_count || 0;

  document.getElementById("similarityList").innerHTML = pairs.length
    ? `
        <div class="muted">${pairCount} similar review pair(s) detected.</div>
        ${pairs
          .map(
            (pair) => `
              <article class="review-item">
                <strong>Review ${pair.left_index} vs Review ${pair.right_index} - ${pair.similarity}% similar</strong>
                <p>${pair.left_excerpt}</p>
                <p>${pair.right_excerpt}</p>
              </article>
            `
          )
          .join("")}
      `
    : '<div class="muted">No strongly repeated review wording was detected in this scan.</div>';
}

function renderPatternList(analytics) {
  const patterns = analytics?.pattern_counts || {};
  const entries = Object.entries(patterns);

  document.getElementById("patternList").innerHTML = entries.length
    ? entries
        .map(
          ([label, count]) => `
            <div class="tag">
              <span>${label.replace(/_/g, " ")}</span>
              <strong>${count}</strong>
            </div>
          `
        )
        .join("")
    : '<div class="muted">No strong suspicious wording patterns were detected in this scan.</div>';
}

function renderSuspiciousReviews(analytics) {
  const items = analytics?.top_suspicious_reviews || [];
  document.getElementById("suspiciousList").innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="review-item">
              <strong>${item.label} - ${item.fake_probability}% fake risk</strong>
              <p>${item.review}</p>
              <div class="review-reasons">
                ${(item.warning_reasons || [])
                  .map((reason) => `<span class="reason-chip">${reason}</span>`)
                  .join("")}
                <span class="reason-chip">Sentiment: ${(item.sentiment?.label || "neutral")}</span>
              </div>
            </article>
          `
        )
        .join("")
    : '<div class="muted">No suspicious reviews stood out in this scan.</div>';
}

function renderHistoryTrend(history) {
  const points = [...history]
    .reverse()
    .slice(-8)
    .map((entry, index) => ({
      value: entry.summary?.overall_trust_score || 0,
      label: entry.hostname || `Scan ${index + 1}`
    }));

  document.getElementById("historyTrend").innerHTML = createTrendChart(
    points,
    "#2563eb",
    "Run a few scans to unlock history-based trend analysis."
  );
}

function renderTrendChart(analytics) {
  const points = (analytics?.trend_points || []).map((point) => ({
    value: point.fake_probability,
    label: `Review ${point.index}`
  }));

  document.getElementById("trendChart").innerHTML = createTrendChart(
    points,
    "#f97316",
    "Trend analysis appears after a page scan."
  );
}

function renderDashboard(data, history = []) {
  const summary = data.summary || {};
  const analytics = data.analytics || {};
  currentAnalysis = data;

  document.getElementById("dashboard").classList.remove("hidden");

  setMetric("heroTrustScore", `${summary.overall_trust_score || 0}%`);
  setMetric("metricTotalReviews", summary.total_reviews || 0);
  setMetric("metricFakeReviews", summary.fake_reviews || 0);
  setMetric("metricGenuineReviews", summary.genuine_reviews || 0);
  setMetric(
    "metricAverageRisk",
    `${(analytics.average_fake_probability || 0).toFixed(1)}%`
  );

  renderPieChart(summary);
  renderTrendChart(analytics);
  renderSentimentBars(analytics, summary.total_reviews || 0);
  renderRiskBars(analytics, summary.total_reviews || 0);
  renderSimilarityList(analytics);
  renderPatternList(analytics);
  renderSuspiciousReviews(analytics);
  renderHistoryTrend(history);
}

function renderHistoryOnly(history = []) {
  if (!history.length) {
    return;
  }

  const latest = history[0];
  currentAnalysis = latest;
  document.getElementById("dashboard").classList.remove("hidden");
  setMetric("heroTrustScore", `${latest.summary?.overall_trust_score || 0}%`);
  setMetric("metricTotalReviews", latest.summary?.total_reviews || 0);
  setMetric("metricFakeReviews", latest.summary?.fake_reviews || 0);
  setMetric("metricGenuineReviews", latest.summary?.genuine_reviews || 0);
  setMetric(
    "metricAverageRisk",
    `${(latest.analytics?.average_fake_probability || 0).toFixed(1)}%`
  );
  renderPieChart(latest.summary || {});
  renderTrendChart(latest.analytics || {});
  renderSentimentBars(latest.analytics || {}, latest.summary?.total_reviews || 0);
  renderRiskBars(latest.analytics || {}, latest.summary?.total_reviews || 0);
  renderSimilarityList(latest.analytics || {});
  renderPatternList(latest.analytics || {});
  renderSuspiciousReviews(latest.analytics || {});
  renderHistoryTrend(history);
}

function downloadTextFile(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportReport() {
  if (!currentAnalysis) {
    setStatus("Run an analysis first so there is data to export.", true);
    return;
  }

  const summary = currentAnalysis.summary || {};
  const analytics = currentAnalysis.analytics || {};
  const results = currentAnalysis.results || [];
  const exportedAt = new Date().toISOString();
  const report = {
    exportedAt,
    summary,
    analytics,
    results
  };

  const stamp = exportedAt.replace(/[:.]/g, "-");
  downloadTextFile(
    `fake-review-report-${stamp}.json`,
    JSON.stringify(report, null, 2),
    "application/json"
  );

  const csvRows = [
    ["review", "label", "confidence", "fake_probability", "genuine_probability", "sentiment", "warning_reasons"].join(","),
    ...results.map((result) => {
      const safe = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      return [
        safe(result.review),
        safe(result.label),
        safe(result.confidence),
        safe(result.probabilities?.fake),
        safe(result.probabilities?.genuine),
        safe(result.sentiment?.label),
        safe((result.warning_reasons || []).join("; "))
      ].join(",");
    })
  ].join("\n");

  downloadTextFile(
    `fake-review-report-${stamp}.csv`,
    csvRows,
    "text/csv"
  );

  setStatus("Exported JSON and CSV report files.");
}

function buildPrintableReportHtml(data) {
  const summary = data.summary || {};
  const analytics = data.analytics || {};
  const results = data.results || [];

  const suspicious = (analytics.top_suspicious_reviews || [])
    .map(
      (item) => `
        <li>
          <strong>${item.label} - ${item.fake_probability}% fake risk</strong><br>
          ${item.review}<br>
          Reasons: ${(item.warning_reasons || []).join(", ") || "None"}
        </li>
      `
    )
    .join("");

  const similarity = (analytics.review_similarity?.top_similar_pairs || [])
    .map(
      (pair) => `
        <li>Review ${pair.left_index} vs ${pair.right_index} - ${pair.similarity}% similar</li>
      `
    )
    .join("");

  const detailRows = results
    .map(
      (result) => `
        <tr>
          <td>${result.label}</td>
          <td>${((result.probabilities?.fake || 0) * 100).toFixed(1)}%</td>
          <td>${result.sentiment?.label || "neutral"}</td>
          <td>${(result.warning_reasons || []).join(", ")}</td>
          <td>${result.review}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Fake Review Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 28px; color: #1f2937; }
          h1, h2 { margin-bottom: 8px; }
          .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
          .card { border: 1px solid #d1d5db; border-radius: 10px; padding: 12px; min-width: 160px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; text-align: left; font-size: 12px; }
          ul { padding-left: 18px; }
        </style>
      </head>
      <body>
        <h1>Fake Review Detector Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <div class="cards">
          <div class="card"><strong>Total Reviews</strong><br>${summary.total_reviews || 0}</div>
          <div class="card"><strong>Trust Score</strong><br>${summary.overall_trust_score || 0}%</div>
          <div class="card"><strong>Fake Reviews</strong><br>${summary.fake_reviews || 0}</div>
          <div class="card"><strong>Average Fake Risk</strong><br>${analytics.average_fake_probability || 0}%</div>
        </div>
        <h2>Sentiment</h2>
        <p>Positive: ${analytics.sentiment_distribution?.positive || 0}, Neutral: ${analytics.sentiment_distribution?.neutral || 0}, Negative: ${analytics.sentiment_distribution?.negative || 0}</p>
        <h2>Similarity Signals</h2>
        <ul>${similarity || "<li>No strong repeated wording found.</li>"}</ul>
        <h2>Top Suspicious Reviews</h2>
        <ul>${suspicious || "<li>No suspicious reviews highlighted.</li>"}</ul>
        <h2>Review Details</h2>
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Fake Risk</th>
              <th>Sentiment</th>
              <th>Warnings</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>${detailRows}</tbody>
        </table>
        <script>
          window.onload = function () {
            setTimeout(function () { window.print(); }, 300);
          };
        </script>
      </body>
    </html>
  `;
}

function printReport() {
  if (!currentAnalysis || !currentAnalysis.results) {
    setStatus("Run an analysis first so there is data to print.", true);
    return;
  }

  const html = buildPrintableReportHtml(currentAnalysis);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function loadSettings() {
  const apiResponse = await chrome.runtime.sendMessage({ type: "GET_API_BASE_URL" });
  if (apiResponse.ok) {
    document.getElementById("apiBaseUrl").value = apiResponse.apiBaseUrl;
    document.getElementById("apiKey").value = apiResponse.apiKey || "";
    document.getElementById("autoScan").checked = Boolean(apiResponse.autoScan);
    document.getElementById("threshold").value = apiResponse.threshold ?? 0.5;
  }
}

async function loadHistory() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SCAN_HISTORY" });
  return response.ok ? response.history : [];
}

async function inspectPage() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    setStatus("No active tab found.", true);
    return;
  }

  const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_CONTEXT" });
  if (!response?.ok) {
    setStatus("Open a supported ecommerce product page first.", true);
    return;
  }

  if (!response.data.supported) {
    setStatus(`This site is not supported yet: ${response.data.hostname}`, true);
    return;
  }

  const history = await loadHistory();
  setStatus(`Ready. Found ${response.data.detectedReviews} reviews on ${response.data.hostname}.`);

  if (response.data.lastAnalysis) {
    renderDashboard(response.data.lastAnalysis, history);
  } else {
    renderHistoryOnly(history);
  }
}

async function saveApiUrl() {
  const apiBaseUrl = document.getElementById("apiBaseUrl").value.trim();
  const apiKey = document.getElementById("apiKey").value.trim();
  const autoScan = document.getElementById("autoScan").checked;
  const threshold = Number(document.getElementById("threshold").value || 0.5);
  const response = await chrome.runtime.sendMessage({
    type: "SET_API_SETTINGS",
    apiBaseUrl,
    apiKey,
    autoScan,
    threshold
  });

  if (!response.ok) {
    setStatus(response.error || "Could not save API URL.", true);
    return;
  }

  setStatus("Settings saved.");
}

async function analyzePage() {
  const tab = await getActiveTab();
  const threshold = Number(document.getElementById("threshold").value || 0.5);

  if (!tab?.id) {
    setStatus("No active tab found.", true);
    return;
  }

  setStatus("Analyzing reviews on this page...");
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "RUN_PAGE_ANALYSIS",
    threshold
  });

  if (!response?.ok) {
    setStatus(response?.error || "Analysis failed.", true);
    return;
  }

  renderDashboard(response.data, response.history || []);
  setStatus(`Analysis complete for ${response.data.page.hostname}.`);
}

document.getElementById("saveButton").addEventListener("click", saveApiUrl);
document.getElementById("analyzeButton").addEventListener("click", analyzePage);
document.getElementById("exportButton").addEventListener("click", exportReport);
document.getElementById("printButton").addEventListener("click", printReport);

Promise.all([loadSettings(), inspectPage()]).catch((error) => {
  setStatus(error.message || "Could not load extension state.", true);
});
