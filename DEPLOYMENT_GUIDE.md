# Fake Review Detector Deployment Guide

This guide moves your project from local testing to a hosted API plus Chrome extension setup.

## 1. Run locally first

From the project root:

```powershell
python src/api.py
```

Health check:

```powershell
curl http://127.0.0.1:5000/health
```

Prediction test:

```powershell
curl -X POST http://127.0.0.1:5000/predict ^
  -H "Content-Type: application/json" ^
  -d "{\"reviews\":[\"This product is amazing and works perfectly\"],\"threshold\":0.5}"
```

## 2. Recommended production environment variables

- `PORT=5000`
- `FLASK_HOST=0.0.0.0`
- `FLASK_DEBUG=false`
- `ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID`
- `FAKE_REVIEW_API_KEY=your-secret-key`

## 3. Deploy on Render

Files included:

- `src/api_requirements.txt`
- `src/render.yaml`

Steps:

1. Push the project to GitHub.
2. Create a new Render web service.
3. Point it to this repo.
4. Use the provided `src/render.yaml` values or set them manually.
5. After deploy, open `/health` on the hosted URL.

Example hosted URL:

```text
https://fake-review-api.onrender.com
```

## 4. Connect the extension

1. Open `chrome://extensions/`
2. Load the `chrome-extension` folder
3. Open the extension popup
4. Paste your hosted URL
5. Paste your API key if enabled
6. Save settings

## 5. Important production advice

- Keep the model on the server, not inside the extension
- Restrict CORS to your extension origin
- Use an API key to reduce abuse
- Log prediction failures and slow requests
- Start with Amazon support, then expand site selectors gradually

## 6. Best next engineering tasks

1. Add better selectors for Myntra and Meesho
2. Add a dashboard injected at the top of the review section
3. Return explanation fields from the API
4. Add request logging and analytics
5. Prepare Chrome Web Store listing assets
