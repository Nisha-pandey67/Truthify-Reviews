# Fake Review Detector Chrome Extension

This folder contains a starter Chrome extension that connects your ecommerce review pages to the Flask model API in `src/api.py`.

## Folder structure

- `manifest.json`: Chrome extension manifest (Manifest V3)
- `background.js`: Sends requests to your Flask API and stores hosted API settings
- `content.js`: Reads reviews from supported product pages and injects labels
- `content.css`: Styles the injected labels
- `popup.html`, `popup.css`, `popup.js`: Small extension control panel

## How to run the backend

From the project root:

```powershell
python src/api.py
```

The extension expects the API at `http://127.0.0.1:5000` by default.

## Production settings

- Open the extension popup and set your hosted backend URL
- If you configured `FAKE_REVIEW_API_KEY` on the backend, paste the same key in the popup
- Restrict backend CORS with `ALLOWED_ORIGINS`

## How to load the extension

1. Open Chrome.
2. Go to `chrome://extensions/`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select this `chrome-extension` folder.

## Current support

- Amazon product review pages
- Basic Flipkart review containers

## Next improvements

- Add Myntra and Meesho selectors
- Show per-review explanation
- Add product-level dashboard on the page
- Publish the extension with store assets and a privacy policy
