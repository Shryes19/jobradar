# Deployment Guide — JobRadar

## Architecture

```
Frontend (Vercel)  →  Backend API (Render)  →  PostgreSQL (Render)
```

---

## 1. Backend — Render.com

### One-time setup

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect your GitHub repo. Render will detect `render.yaml` automatically.
4. It will create:
   - A **Web Service** (`jobradar-api`) running the FastAPI backend
   - A **PostgreSQL** database (`jobradar-db`)

### Set environment variables in Render dashboard

After the blueprint deploys, go to **jobradar-api → Environment** and add:

| Key | Value |
|---|---|
| `GROQ_API_KEY` | Your Groq key (from console.groq.com) |
| `APIFY_API_KEY` | Your Apify key (from console.apify.com) |

`SECRET_KEY` and `DATABASE_URL` are set automatically by `render.yaml`.

### Your backend URL will be:
```
https://jobradar-api.onrender.com
```

---

## 2. Frontend — Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → Import your GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Add this **Environment Variable** in Vercel project settings:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://jobradar-api.onrender.com` |

4. Click **Deploy**.

### Update CORS on backend

After you get your Vercel URL (e.g. `https://jobradar.vercel.app`), update `backend/app/main.py`:

```python
allow_origins=[
    "http://localhost:5173",
    "https://jobradar.vercel.app",   # ← your Vercel URL
    "https://*.vercel.app",
],
```

Then push to trigger a Render redeploy.

---

## 3. Local development

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Environment variables reference

### Backend (.env)
```
GROQ_API_KEY=gsk_...
APIFY_API_KEY=apify_api_...
SECRET_KEY=<random 64 hex chars — generate with: python -c "import secrets; print(secrets.token_hex(32))">
DATABASE_URL=sqlite:///./jobradar.db   # local dev only — Render sets this automatically
```

### Frontend (.env.local)
```
VITE_API_URL=http://localhost:8000   # local dev
```

For production, set `VITE_API_URL` in Vercel dashboard instead.
