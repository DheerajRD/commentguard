# 🛡️ CommentGuard AI

Scan hundreds of Instagram & Twitter/X comments instantly — detects toxic, negative, and spam comments using Claude AI.

---

## 🚀 Deploy to Vercel in 10 Minutes

### Step 1 — Get your API keys

**Anthropic (Claude AI):**
1. Go to https://console.anthropic.com
2. API Keys → Create Key
3. Copy it (starts with `sk-ant-...`)

**Apify (Instagram/Twitter scraper):**
1. Go to https://apify.com and sign up free
2. Settings → API & Integrations
3. Copy your Personal API Token

---

### Step 2 — Upload to GitHub

1. Go to https://github.com → New repository → name it `commentguard-ai`
2. Upload all these files (keep the folder structure):
   ```
   commentguard-ai/
   ├── api/
   │   ├── scrape.js
   │   └── analyse.js
   ├── src/
   │   ├── main.jsx
   │   └── App.jsx
   ├── index.html
   ├── package.json
   ├── vite.config.js
   └── vercel.json
   ```
3. Commit and push

---

### Step 3 — Deploy on Vercel

1. Go to https://vercel.com → Sign up with GitHub
2. Click **"Add New Project"**
3. Import your `commentguard-ai` repo
4. Framework Preset: **Vite**
5. Click **"Environment Variables"** and add:
   ```
   ANTHROPIC_API_KEY = sk-ant-your-key-here
   ```
6. Click **Deploy** ✅

---

### Step 4 — Use It!

1. Open your Vercel URL (e.g. `commentguard-ai.vercel.app`)
2. Enter your **Apify token** in the app
3. Paste any **public Instagram or Twitter post URL**
4. Choose how many comments to scan (50–500)
5. Hit **Fetch & Analyse** — results in ~30–60 seconds!

---

## 💡 How it works

```
User pastes URL
      ↓
Browser → POST /api/scrape (Vercel serverless)
      ↓
Vercel → Apify API (scrapes Instagram/Twitter)
      ↓
Raw comments returned to browser
      ↓
Browser → POST /api/analyse (Vercel serverless)
      ↓
Vercel → Anthropic Claude API (classifies each comment)
      ↓
Results shown: Toxic ☠️ | Negative 👎 | Spam 🚫 | Neutral 💬 | Positive ✅
```

## 💰 Cost

- **Vercel**: Free (Hobby tier is more than enough)
- **Apify**: Free $5 credits/month (~500 comment scrapes)
- **Anthropic**: ~$0.01 per 100 comments analysed

## 🔒 Privacy

- Your Apify token is entered in the browser and sent only to your own Vercel backend
- Comments are processed server-side and never stored
- The `ANTHROPIC_API_KEY` stays safe in Vercel environment variables (never exposed to browser)
