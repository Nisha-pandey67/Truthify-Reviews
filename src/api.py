from flask import Flask, jsonify, request
from flask_cors import CORS
import joblib
import numpy as np
import os
import re
from collections import Counter

app = Flask(__name__)

base_dir = os.path.dirname(__file__)
model = joblib.load(os.path.join(base_dir, "model.pkl"))
vectorizer = joblib.load(os.path.join(base_dir, "tfidf_vectorizer.pkl"))

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]
API_KEY = os.getenv("FAKE_REVIEW_API_KEY", "").strip()
SUSPICIOUS_PATTERNS = {
    "overpromotional": [
        "must buy",
        "highly recommend",
        "best product ever",
        "worth every penny",
        "amazing product",
        "awesome product",
    ],
    "urgency": [
        "buy now",
        "don't miss",
        "limited time",
        "grab it",
    ],
    "authenticity_pressure": [
        "100% genuine",
        "totally genuine",
        "original product",
    ],
    "short_excitement": [
        "wow",
        "super",
        "awesome",
        "excellent",
    ],
}
POSITIVE_WORDS = {
    "good", "great", "excellent", "amazing", "awesome", "nice", "love",
    "loved", "perfect", "fresh", "tasty", "soft", "delicious", "happy",
    "best", "wonderful", "satisfied", "recommend", "quality",
}
NEGATIVE_WORDS = {
    "bad", "worst", "poor", "fake", "awful", "terrible", "stale", "hard",
    "broken", "waste", "hate", "hated", "disappointed", "slow", "problem",
    "issue", "smell", "tasteless", "refund", "damaged",
}

CORS(
    app,
    resources={
        r"/predict": {
            "origins": ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else "*",
        },
        r"/health": {
            "origins": ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else "*",
        },
    },
)


def is_authorized(req):
    if not API_KEY:
        return True
    return req.headers.get("X-API-Key", "").strip() == API_KEY


def classify_review(review_text, threshold):
    x_text = vectorizer.transform([review_text])
    dummy = np.zeros((1, 11))
    features = np.hstack((x_text.toarray(), dummy))

    probabilities = model.predict_proba(features)[0]
    fake_probability = float(probabilities[1])
    human_probability = float(probabilities[0])
    is_genuine = human_probability >= threshold

    return {
        "review": review_text,
        "label": "Genuine" if is_genuine else "Fake",
        "confidence": human_probability if is_genuine else fake_probability,
        "probabilities": {
            "fake": fake_probability,
            "genuine": human_probability,
        },
    }


def detect_patterns(review_text):
    lowered = review_text.lower()
    matches = []

    for label, phrases in SUSPICIOUS_PATTERNS.items():
        if any(phrase in lowered for phrase in phrases):
            matches.append(label)

    if review_text.count("!") >= 2:
        matches.append("excessive_punctuation")
    if len(review_text.split()) <= 4:
        matches.append("very_short_review")
    if re.search(r"(.)\1{3,}", lowered):
        matches.append("repeated_characters")

    return sorted(set(matches))


def get_risk_bucket(fake_probability):
    if fake_probability >= 0.7:
        return "high"
    if fake_probability >= 0.4:
        return "medium"
    return "low"


def get_warning_reasons(review_text, fake_probability, patterns):
    reasons = []

    if fake_probability >= 0.7:
        reasons.append("High fake-probability score")
    elif fake_probability >= 0.4:
        reasons.append("Moderate fake-probability score")

    label_map = {
        "overpromotional": "Overpromotional wording",
        "urgency": "Artificial urgency language",
        "authenticity_pressure": "Too much focus on authenticity claims",
        "short_excitement": "Low-detail excitement wording",
        "excessive_punctuation": "Too many exclamation marks",
        "very_short_review": "Very short review with low detail",
        "repeated_characters": "Repeated characters or stretched words",
    }

    for pattern in patterns:
        if pattern in label_map:
            reasons.append(label_map[pattern])

    return reasons[:4]


def analyze_sentiment(review_text):
    words = re.findall(r"\b[a-zA-Z]+\b", review_text.lower())
    if not words:
        return {"label": "neutral", "score": 0.0}

    positive_hits = sum(1 for word in words if word in POSITIVE_WORDS)
    negative_hits = sum(1 for word in words if word in NEGATIVE_WORDS)
    score = (positive_hits - negative_hits) / max(len(words), 1)

    if score > 0.03:
        label = "positive"
    elif score < -0.03:
        label = "negative"
    else:
        label = "neutral"

    return {"label": label, "score": round(score, 4)}


def build_similarity_insights(results):
    review_tokens = []
    for result in results:
        tokens = {
            token
            for token in re.findall(r"\b[a-zA-Z]{3,}\b", result["review"].lower())
            if token not in {"this", "that", "with", "from", "have", "would", "very"}
        }
        review_tokens.append(tokens)

    similar_pairs = []

    for left in range(len(results)):
        for right in range(left + 1, len(results)):
            left_tokens = review_tokens[left]
            right_tokens = review_tokens[right]
            if not left_tokens or not right_tokens:
                continue

            union = left_tokens | right_tokens
            if not union:
                continue

            similarity = len(left_tokens & right_tokens) / len(union)
            if similarity >= 0.55:
                similar_pairs.append(
                    {
                        "left_index": left + 1,
                        "right_index": right + 1,
                        "similarity": round(similarity * 100, 2),
                        "left_excerpt": results[left]["review"][:120],
                        "right_excerpt": results[right]["review"][:120],
                    }
                )

    similar_pairs.sort(key=lambda item: item["similarity"], reverse=True)
    return {
        "similar_pair_count": len(similar_pairs),
        "top_similar_pairs": similar_pairs[:5],
    }


def build_analytics(results):
    fake_probabilities = [result["probabilities"]["fake"] for result in results]
    bucket_counter = Counter()
    pattern_counter = Counter()
    sentiment_counter = Counter()
    suspicious_reviews = []
    trend_points = []
    sentiment_points = []

    for index, result in enumerate(results, start=1):
        fake_probability = result["probabilities"]["fake"]
        bucket = get_risk_bucket(fake_probability)
        patterns = result.get("patterns", [])
        sentiment = result.get("sentiment", {"label": "neutral", "score": 0.0})

        bucket_counter[bucket] += 1
        pattern_counter.update(patterns)
        sentiment_counter.update([sentiment["label"]])

        trend_points.append(
            {
                "index": index,
                "fake_probability": round(fake_probability * 100, 2),
                "genuine_probability": round(result["probabilities"]["genuine"] * 100, 2),
                "label": result["label"],
            }
        )
        sentiment_points.append(
            {
                "index": index,
                "sentiment_score": round(sentiment["score"] * 100, 2),
                "sentiment_label": sentiment["label"],
            }
        )

        if result["label"] == "Fake" or bucket == "high" or patterns:
            suspicious_reviews.append(
                {
                    "review": result["review"],
                    "label": result["label"],
                    "fake_probability": round(fake_probability * 100, 2),
                    "patterns": patterns,
                    "warning_reasons": result.get("warning_reasons", []),
                    "sentiment": sentiment,
                }
            )

    suspicious_reviews.sort(
        key=lambda item: item["fake_probability"],
        reverse=True,
    )

    similarity = build_similarity_insights(results)

    return {
        "average_fake_probability": round(float(np.mean(fake_probabilities)) * 100, 2),
        "risk_distribution": {
            "high": bucket_counter.get("high", 0),
            "medium": bucket_counter.get("medium", 0),
            "low": bucket_counter.get("low", 0),
        },
        "pattern_counts": dict(pattern_counter.most_common(6)),
        "sentiment_distribution": {
            "positive": sentiment_counter.get("positive", 0),
            "neutral": sentiment_counter.get("neutral", 0),
            "negative": sentiment_counter.get("negative", 0),
        },
        "review_similarity": similarity,
        "trend_points": trend_points,
        "sentiment_points": sentiment_points,
        "top_suspicious_reviews": suspicious_reviews[:5],
    }


@app.route("/")
def home():
    return jsonify(
        {
            "message": "Fake review detection API is running",
            "routes": ["/health", "/predict"],
            "cors": ALLOWED_ORIGINS,
            "api_key_required": bool(API_KEY),
        }
    )


@app.route("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "model_loaded": model is not None,
            "vectorizer_loaded": vectorizer is not None,
        }
    )


@app.route("/predict", methods=["POST"])
def predict():
    if not is_authorized(request):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    reviews = data.get("reviews", [])
    threshold = float(data.get("threshold", 0.5))
    threshold = max(0.0, min(1.0, threshold))

    if isinstance(reviews, str):
        reviews = [reviews]

    clean_reviews = [review.strip() for review in reviews if isinstance(review, str) and review.strip()]
    if not clean_reviews:
        return jsonify({"error": "Please provide at least one review in `reviews`."}), 400

    results = []
    for review in clean_reviews:
        result = classify_review(review, threshold)
        patterns = detect_patterns(review)
        sentiment = analyze_sentiment(review)
        result["patterns"] = patterns
        result["warning_reasons"] = get_warning_reasons(
            review,
            result["probabilities"]["fake"],
            patterns,
        )
        result["sentiment"] = sentiment
        results.append(result)
    genuine_count = sum(1 for result in results if result["label"] == "Genuine")
    trust_score = round((genuine_count / len(results)) * 100, 2)

    response = {
        "summary": {
            "total_reviews": len(results),
            "genuine_reviews": genuine_count,
            "fake_reviews": len(results) - genuine_count,
            "overall_trust_score": trust_score,
            "threshold": threshold,
        },
        "analytics": build_analytics(results),
        "results": results,
    }
    return jsonify(response)


if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "true").lower() == "true",
    )
