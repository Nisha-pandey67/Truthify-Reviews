# 🔍 Truthify Reviews

> AI-powered Chrome Extension to detect fake product reviews using Machine Learning

---

## 🚀 Overview

**Truthify Reviews** is a Chrome Extension + backend system that analyzes product reviews and classifies them as **Fake** or **Genuine** using a trained machine learning model.

It helps users make smarter buying decisions by identifying misleading or spam reviews on e-commerce platforms.

---

## ✨ Features

* 🔎 Detects **fake vs genuine reviews**
* ⚡ Fast predictions using Flask API
* 🧠 ML model (TF-IDF + classification)
* 🌐 Works directly on product pages
* 🧩 Chrome Extension integration
* 📊 Trained on large dataset (100K+ reviews)

---

## 🛠 Tech Stack

**Frontend (Extension):**

* JavaScript
* HTML, CSS (Chrome Extension Manifest V3)

**Backend:**

* Python
* Flask

**Machine Learning:**

* Scikit-learn
* TF-IDF Vectorizer
* Logistic Regression

---

## 📂 Project Structure

```
Truthify-Reviews/
│
├── chrome-extension/      # Chrome extension files
├── src/                   # Backend API + ML model
│   ├── api.py
│   ├── model.pkl
│   ├── tfidf_vectorizer.pkl
│
├── .gitignore
├── DEPLOYMENT_GUIDE.md
├── dockerfile
└── README.md
```

---

## ⚙️ How to Run Locally

### 1️⃣ Clone the repository

```
git clone https://github.com/Nisha-pandey67/Truthify-Reviews.git
cd Truthify-Reviews
```

---

### 2️⃣ Setup backend

```
pip install -r src/api_requirements.txt
python src/api.py
```

API will run at:

```
http://127.0.0.1:5000
```

---

### 3️⃣ Load Chrome Extension

1. Open Chrome
2. Go to: `chrome://extensions/`
3. Enable **Developer Mode**
4. Click **Load Unpacked**
5. Select `chrome-extension/` folder

---

### 4️⃣ Use the Extension

* Open any product page (Amazon / Flipkart)
* Activate extension
* Reviews will be labeled as:

  * ✅ Genuine
  * ❌ Fake

---

## 🧠 How It Works

1. Reviews are extracted from the webpage
2. Sent to Flask API
3. Converted using TF-IDF
4. Passed to trained ML model
5. Prediction returned (Fake / Genuine)

---

## 🔮 Future Improvements

* 📊 Confidence score (e.g., Fake – 92%)
* 🧠 Explanation for predictions
* 🛒 Support for more platforms
* ☁️ Full cloud deployment
* 📈 Analytics dashboard

---

## 📜 License

This project is licensed under the MIT License.

---

## 👩‍💻 Author

**Nisha Pandey**
GitHub: https://github.com/Nisha-pandey67

---

## ⭐ Support

If you like this project, give it a ⭐ on GitHub!


