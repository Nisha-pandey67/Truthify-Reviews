import streamlit as st
import os
import nltk
import joblib
import numpy as np
import pandas as pd
import altair as alt
from textblob import TextBlob

# -------------------------------
# 1. Page & Vibrant Layout Config
# -------------------------------
st.set_page_config(
    page_title="Opinion Manipulation Detection System",
    page_icon="🛡️",
    layout="wide"
)

st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        
        /* 1. GLOBAL BACKGROUND: Soft Pink to Deep Violet */
        .stApp {
            background: linear-gradient(105deg, 
                #FFDBFD 0%, 
                #FFDBFD 25%, 
                #C9BEFF 55%, 
                #8494FF 85%, 
                #6367FF 100%) !important;
            background-attachment: fixed !important;
        }

        /* 2. ULTIMATE SLIDER RESET (NO MORE RED) */
        section[data-testid="stSidebar"] {
            background-color: transparent !important;
        }

        /* Target the 'Red' part of the slider by neutralizing the gradient */
        div[data-baseweb="slider"] div[style*="background: rgb(255, 75, 75)"],
        div[data-baseweb="slider"] div[style*="background: #ff4b4b"],
        div[data-baseweb="slider"] div[style*="background-color: rgb(255, 75, 75)"] {
            background: #8494FF !important;
            background-image: none !important;
        }

        /* Slider Knob & Track */
        div[data-baseweb="slider"] [role="slider"] {
            background-color: #6367FF !important;
            border: 2px solid #FFDBFD !important;
        }
        
        /* Sidebar Text Contrast */
        section[data-testid="stSidebar"] h2, 
        section[data-testid="stSidebar"] label,
        div[data-baseweb="slider"] div {
            color: #6367FF !important;
            font-weight: 800 !important;
        }

        /* 3. ALIGNMENT & BOX CONTRAST */
        .main .block-container {
            max-width: 900px !important;
            margin: 0 auto !important;
            padding-top: 2rem !important;
        }

        .app-header {
            color: #6367FF;
            font-size: 3.5rem;
            font-weight: 800;
            margin-bottom: 0px;
        }
        
        .app-subtitle {
            color: #6367FF;
            opacity: 0.8;
            font-size: 1.1rem;
            margin-bottom: 2rem;
        }

        /* TEXT AREA: HIGH VISIBILITY DARK TEXT */
        .stTextArea textarea {
            border-radius: 15px !important;
            border: 2px solid #C9BEFF !important;
            background: rgba(255, 255, 255, 0.95) !important;
            padding: 20px !important;
            color: #1A1A1A !important; /* Visible Black Text */
            font-size: 1.1rem !important;
            box-shadow: 0 10px 30px rgba(99, 103, 255, 0.1);
        }

        /* 4. BUTTON */
        div.stButton > button {
            background: #6367FF !important;
            color: #FFFFFF !important;
            border: none !important;
            padding: 18px !important;
            border-radius: 12px !important;
            font-weight: 800 !important;
            width: 100% !important;
            margin-top: 10px;
            box-shadow: 0 10px 25px rgba(99, 103, 255, 0.3);
        }

        /* 5. RESULT CARD */
        .result-box {
            background: white !important;
            border-radius: 20px;
            padding: 35px;
            margin-top: 25px;
            border: 1px solid #E0E0E0;
            box-shadow: 0 30px 60px rgba(0,0,0,0.15);
        }
    </style>
    """, unsafe_allow_html=True)

# -------------------------------
# 2. Setup & Backend Logic
# -------------------------------
os.environ["NLTK_DATA"] = "/tmp/nltk_data"
os.makedirs("/tmp/nltk_data", exist_ok=True)
nltk.data.path.insert(0, "/tmp/nltk_data")

@st.cache_resource
def load_model_vectorizer():
    base_dir = os.path.dirname(__file__)
    m_path, v_path = os.path.join(base_dir, "model.pkl"), os.path.join(base_dir, "tfidf_vectorizer.pkl")
    if not os.path.exists(m_path) or not os.path.exists(v_path): return None, None
    return joblib.load(m_path), joblib.load(v_path)

model, vectorizer = load_model_vectorizer()

# -------------------------------
# 3. Sidebar
# -------------------------------
with st.sidebar:
    st.markdown("## Model Efficiency")
    threshold = st.slider("Sensitivity", 0.0, 1.0, 0.50, 0.05)
    st.divider()
    st.caption("Built by Abhishek,Nisha,Abhishek Raj,Neha,Aayush")

# -------------------------------
# 4. Main UI
# -------------------------------
st.markdown('<h1 class="app-header">Opinion Manipulation Detection System</h1>', unsafe_allow_html=True)
st.markdown('<p class="app-subtitle">Detect fake reviews on E-Commerce platforms like Amazon,Myntra,Meesho,Flipkart,Best buy and target uncover online review scams, and get a clear trust score you can trust</p>', unsafe_allow_html=True)

review_text = st.text_area("Input", placeholder="Paste text here to analyze...", height=200, key="main_input", label_visibility="collapsed")

if st.button("Check Review"):
    if not review_text.strip():
        st.error("Input required.")
    else:
        # Prediction Process
        x_text = vectorizer.transform([review_text])
        dummy = np.zeros((1, 11)) 
        feats = np.hstack((x_text.toarray(), dummy))
        
        try:
            probs = model.predict_proba(feats)[0]
            prediction = 1 if probs[1] >= threshold else 0
            
            # --- START ANALYTICS RESULT CARD ---
            st.markdown('<div class="result-box">', unsafe_allow_html=True)
            
            status = "VERIFIED HUMAN" if prediction == 1 else "Manipulative Reviewv"
            status_color = "#8494FF" if prediction == 1 else "#6367FF"
            
            st.markdown(f"<p style='color:{status_color}; font-weight:800; margin:0;'>FORENSIC STATUS</p>", unsafe_allow_html=True)
            st.markdown(f"<h1 style='margin:0; color:#6367FF;'>{status}</h1>", unsafe_allow_html=True)
            
            st.markdown("<hr style='margin:25px 0; opacity:0.1;'>", unsafe_allow_html=True)
            
            # Core Metrics
            col1, col2, col3 = st.columns(3)
            blob = TextBlob(review_text)
            with col1: st.metric("Words", len(review_text.split()))
            with col2: st.metric("Polarity", f"{blob.sentiment.polarity:+.2f}")
            with col3: 
                conf = probs[1] if prediction == 1 else probs[0]
                st.metric("Confidence", f"{conf:.1%}")

            st.markdown("<br>", unsafe_allow_html=True)
            
            # Restoring Visual Charts
            st.markdown("<p style='font-weight:700; color:#6367FF;'>Linguistic Probability Analysis</p>", unsafe_allow_html=True)
            chart_data = pd.DataFrame({
                "Source": ["AI / Synthetic", "Human / Original"],
                "Probability": [probs[0], probs[1]]
            })
            
            c = alt.Chart(chart_data).mark_bar(cornerRadius=10, size=45).encode(
                x=alt.X("Probability:Q", axis=alt.Axis(format='%', title=None)),
                y=alt.Y("Source:N", axis=alt.Axis(title=None)),
                color=alt.Color("Source:N", scale=alt.Scale(domain=["AI / Synthetic", "Human / Original"], range=["#C9BEFF", "#6367FF"]), legend=None)
            ).properties(height=200).configure_view(strokeOpacity=0)
            
            st.altair_chart(c, use_container_width=True)
            
            st.markdown('</div>', unsafe_allow_html=True)
            # --- END RESULT CARD ---
            
        except Exception as e:
            st.error(f"Render Error: {e}")