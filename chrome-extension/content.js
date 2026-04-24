const SITE_CONFIGS = [
  {
    name: "amazon",
    hostPattern: /amazon\./i,
    reviewSelector: '[data-hook="review"]',
    textSelector: '[data-hook="review-body"] span, [data-hook="review-body"]',
    titleSelector: '[data-hook="review-title"] span, [data-hook="review-title"]'
  },
  {
    name: "flipkart",
    hostPattern: /flipkart\.com/i,
    reviewSelector: 'div[data-testid="review"], div.col.EPCmJX, div._27M-vq, div._16PBlm, div._1AtVbE',
    textSelector: 'div.ZmyHeo, div.t-ZTKy, p._2-N8zT, div._6K-7Co, div[data-testid="review-text"], span[data-testid="review-text"]'
  },
  {
    name: "myntra",
    hostPattern: /myntra\.com/i,
    reviewSelector: "",
    textSelector: ""
  }
];

let lastAnalysis = null;

const MIN_REVIEW_LENGTH = 20;
const AUTO_SCAN_KEY = `frd-auto-scan:${window.location.href}`;

function getSiteConfig() {
  return SITE_CONFIGS.find((config) => config.hostPattern.test(window.location.hostname)) || null;
}

function getReviewNodes() {
  const config = getSiteConfig();
  if (!config) {
    return [];
  }

  return Array.from(document.querySelectorAll(config.reviewSelector));
}

function normalizeReviewText(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .replace(/^read more\s*/i, "")
    .trim();
}

function getNodeText(node) {
  return normalizeReviewText(node ? (node.innerText || node.textContent || "") : "");
}

function findBestTextMatch(targetText) {
  if (!targetText) {
    return null;
  }

  const candidates = Array.from(document.querySelectorAll("div, p, span, article, section"));
  let bestNode = null;
  let bestLength = Number.POSITIVE_INFINITY;
  const targetLower = targetText.toLowerCase();

  candidates.forEach((node) => {
    const text = getNodeText(node);
    if (!text) {
      return;
    }

    const textLower = text.toLowerCase();
    const isMatch = textLower === targetLower || textLower.includes(targetLower);
    if (!isMatch) {
      return;
    }

    if (text.length < bestLength && text.length <= targetText.length + 250) {
      bestNode = node;
      bestLength = text.length;
    }
  });

  return bestNode;
}

function extractFlipkartReviews(limit = 15) {
  const textSelectors = [
    "div.ZmyHeo",
    "div.t-ZTKy",
    "p._2-N8zT",
    "div._6K-7Co",
    'div[data-testid="review-text"]',
    'span[data-testid="review-text"]'
  ];
  const containerSelectors = [
    'div[data-testid="review"]',
    "div._27M-vq",
    "div.col.EPCmJX",
    "div._16PBlm",
    "div._1AtVbE"
  ];
  const titleSelectors = [
    "p._2NsDsF",
    "div._6K-7Co",
    'div[data-testid="review-title"]',
    'span[data-testid="review-title"]'
  ];

  const seenTexts = new Set();
  const reviews = [];
  const nodes = Array.from(document.querySelectorAll(textSelectors.join(", ")));

  nodes.forEach((node) => {
    if (reviews.length >= limit) {
      return;
    }

    const text = getNodeText(node);
    if (!text || text.length < MIN_REVIEW_LENGTH || seenTexts.has(text)) {
      return;
    }

    const container =
      node.closest(containerSelectors.join(", ")) ||
      node.parentElement;

    const titleNode = container
      ? container.querySelector(titleSelectors.join(", "))
      : null;
    const title = getNodeText(titleNode);
    const combinedText = title && title !== text ? `${title}. ${text}` : text;

    seenTexts.add(text);
    reviews.push({
      index: reviews.length,
      node: container || node,
      title,
      text: combinedText
    });
  });

  if (reviews.length) {
    return reviews;
  }

  const metadataSelectors = [
    "span",
    "div",
    "p"
  ];
  const fallbackCandidates = Array.from(document.querySelectorAll(metadataSelectors.join(", ")));

  fallbackCandidates.forEach((node) => {
    if (reviews.length >= limit) {
      return;
    }

    const rawText = getNodeText(node);
    const looksLikeReviewCard =
      rawText.includes("Verified Purchase") &&
      (rawText.includes("Flipkart Customer") || rawText.includes("Helpful") || /\d+\.\d/.test(rawText)) &&
      rawText.length >= 40 &&
      rawText.length <= 1200;

    if (!looksLikeReviewCard) {
      return;
    }

    const reviewContainer =
      node.closest("div") ||
      node.parentElement;

    const cleanedText = normalizeReviewText(
      rawText
        .replace(/Verified Purchase/gi, "")
        .replace(/Flipkart Customer[^.]*?/gi, "")
        .replace(/Helpful for \d+/gi, "")
        .replace(/\b\d+\s*(months?|days?|years?)\s+ago\b/gi, "")
        .replace(/\bReview for:[^.]*?/gi, "")
    );

    if (!cleanedText || cleanedText.length < MIN_REVIEW_LENGTH || seenTexts.has(cleanedText)) {
      return;
    }

    seenTexts.add(cleanedText);
    reviews.push({
      index: reviews.length,
      node: reviewContainer || node,
      title: "",
      text: cleanedText
    });
  });

  if (reviews.length) {
    return reviews;
  }

  const verifiedMarkers = Array.from(document.querySelectorAll("div, span, p"))
    .filter((node) => getNodeText(node).includes("Verified Purchase"));

  verifiedMarkers.forEach((marker) => {
    if (reviews.length >= limit) {
      return;
    }

    let container = marker;
    while (container && container !== document.body) {
      const text = getNodeText(container);
      const verifiedCount = (text.match(/Verified Purchase/gi) || []).length;
      if (text.length >= 80 && text.length <= 1500 && verifiedCount === 1) {
        break;
      }
      container = container.parentElement;
    }

    const rawText = getNodeText(container || marker);
    const cleanedText = normalizeReviewText(
      rawText
        .replace(/Verified Purchase/gi, "")
        .replace(/Flipkart Customer[^.]*?/gi, "")
        .replace(/Helpful for \d+/gi, "")
        .replace(/\b\d+\s*(months?|days?|years?)\s+ago\b/gi, "")
        .replace(/\bReview for:[^.]*?/gi, "")
    );

    if (!cleanedText || cleanedText.length < MIN_REVIEW_LENGTH || seenTexts.has(cleanedText)) {
      return;
    }

    seenTexts.add(cleanedText);
    reviews.push({
      index: reviews.length,
      node: container || marker,
      title: "",
      text: cleanedText
    });
  });

  return reviews;
}

function extractMyntraReviews(limit = 15) {
  const scripts = Array.from(document.scripts);
  const reviews = [];
  const seenTexts = new Set();

  for (const script of scripts) {
    const content = script.textContent || "";
    if (!content.includes('"reviewsData":{"reviews":')) {
      continue;
    }

    const match = content.match(/"reviewsData":\{"reviews":(\[.*?\]),"reviewsMetaData"/s);
    if (!match) {
      continue;
    }

    try {
      const parsedReviews = JSON.parse(match[1]);
      parsedReviews.slice(0, limit).forEach((review, index) => {
        const text = normalizeReviewText(review.review || "");
        if (!text || text.length < MIN_REVIEW_LENGTH || seenTexts.has(text)) {
          return;
        }

        seenTexts.add(text);
        const matchedNode =
          findBestTextMatch(text) ||
          findBestTextMatch(text.slice(0, Math.min(text.length, 40)));

        reviews.push({
          index,
          node: matchedNode,
          title: "",
          text
        });
      });
      break;
    } catch (error) {
      console.error("FRD Myntra review parsing failed", error);
    }
  }

  return reviews;
}

function extractReviews(limit = 15) {
  const config = getSiteConfig();
  if (!config) {
    return [];
  }

  if (config.name === "flipkart") {
    return extractFlipkartReviews(limit);
  }

  if (config.name === "myntra") {
    return extractMyntraReviews(limit);
  }

  return getReviewNodes()
    .map((node, index) => {
      const textNode = node.querySelector(config.textSelector);
      const titleNode = config.titleSelector ? node.querySelector(config.titleSelector) : null;
      const text = getNodeText(textNode);
      const title = getNodeText(titleNode);

      return {
        index,
        node,
        title,
        text: title ? `${title}. ${text}` : text
      };
    })
    .filter((review) => review.text)
    .slice(0, limit);
}

function buildBadge(result) {
  const badge = document.createElement("div");
  badge.className = "frd-badge";
  badge.dataset.frdInjected = "true";

  const labelClass = result.label === "Fake" ? "frd-badge--fake" : "frd-badge--genuine";
  badge.innerHTML = `
    <div class="frd-pill ${labelClass}">${result.label}</div>
    <div class="frd-meta">Confidence ${(result.confidence * 100).toFixed(1)}%</div>
  `;

  return badge;
}

function getTrustLevel(summary) {
  const trustScore = summary?.overall_trust_score || 0;
  if (trustScore >= 75) {
    return { label: "High Trust", className: "frd-trust--high" };
  }
  if (trustScore >= 45) {
    return { label: "Mixed Reviews", className: "frd-trust--medium" };
  }
  return { label: "Suspicious Pattern", className: "frd-trust--low" };
}

function buildProductBadge(summary, analytics) {
  const badge = document.createElement("aside");
  badge.className = "frd-product-badge";
  badge.dataset.frdInjected = "true";

  const trust = getTrustLevel(summary);
  const similarityCount = analytics?.review_similarity?.similar_pair_count || 0;

  badge.innerHTML = `
    <div class="frd-product-title">Product Trust</div>
    <div class="frd-product-pill ${trust.className}">${trust.label}</div>
    <div class="frd-product-score">${summary?.overall_trust_score || 0}%</div>
    <div class="frd-product-meta">Fake ${summary?.fake_reviews || 0} / ${summary?.total_reviews || 0}</div>
    <div class="frd-product-meta">Similar pairs ${similarityCount}</div>
  `;

  return badge;
}

function clearInjectedBadges() {
  document.querySelectorAll("[data-frd-injected='true']").forEach((node) => node.remove());
}

function injectResults(analysis) {
  clearInjectedBadges();
  const results = analysis.results || [];
  const reviews = extractReviews(results.length);

  reviews.forEach((review, index) => {
    const result = results[index];
    if (!result || !review.node) {
      return;
    }

    const badge = buildBadge(result);
    review.node.prepend(badge);
  });

  const productBadge = buildProductBadge(analysis.summary || {}, analysis.analytics || {});
  document.body.appendChild(productBadge);
}

function analyzePage(threshold = 0.5) {
  const reviews = extractReviews();

  if (!reviews.length) {
    return Promise.resolve({
      ok: false,
      error: "No supported reviews found on this page."
    });
  }

  return chrome.runtime.sendMessage({
    type: "ANALYZE_REVIEWS",
    reviews: reviews.map((review) => review.text),
    threshold,
    hostname: window.location.hostname,
    url: window.location.href,
    title: document.title
  }).then((response) => {
    if (!response.ok) {
      return response;
    }

    lastAnalysis = response.data;
    injectResults(response.data);
    return {
      ok: true,
      data: {
        ...response.data,
        page: {
          hostname: window.location.hostname,
          review_count: reviews.length
        }
      }
    };
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RUN_PAGE_ANALYSIS") {
    analyzePage(message.threshold)
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_PAGE_CONTEXT") {
    const reviews = extractReviews();
    sendResponse({
      ok: true,
      data: {
        supported: Boolean(getSiteConfig()),
        hostname: window.location.hostname,
        detectedReviews: reviews.length,
        lastAnalysis
      }
    });
    return false;
  }

  return false;
});

async function maybeAutoAnalyze() {
  const config = getSiteConfig();
  if (!config || sessionStorage.getItem(AUTO_SCAN_KEY)) {
    return;
  }

  try {
    const settings = await chrome.runtime.sendMessage({ type: "GET_API_BASE_URL" });
    if (!settings?.ok || !settings.autoScan) {
      return;
    }

    const reviews = extractReviews();
    if (!reviews.length) {
      return;
    }

    sessionStorage.setItem(AUTO_SCAN_KEY, "1");
    await analyzePage(Number(settings.threshold ?? 0.5));
  } catch (error) {
    console.error("FRD auto scan failed", error);
  }
}

window.addEventListener("load", () => {
  setTimeout(() => {
    maybeAutoAnalyze();
  }, 2200);
});
