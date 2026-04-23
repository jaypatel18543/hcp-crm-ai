# PharmaConnect CRM – HCP Interaction Module

An **AI-First CRM** system for pharmaceutical field representatives to log and manage Healthcare Professional (HCP) interactions via a structured form or conversational AI chat.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│          (Redux · Axios · Inter Font · CSS)              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP / REST
┌──────────────────────▼──────────────────────────────────┐
│                  FastAPI Backend                          │
│         /api/interactions  ·  /api/agent/chat            │
└──────────┬───────────────────────────┬──────────────────┘
           │                           │
┌──────────▼──────────┐   ┌────────────▼────────────────┐
│   SQLite / Postgres  │   │     LangGraph AI Agent       │
│   (SQLAlchemy ORM)   │   │  gemma2-9b-it  (Groq API)   │
└─────────────────────┘   │  llama-3.3-70b-versatile     │
                           └─────────────────────────────┘
```

---

## 🧠 LangGraph Agent & 5 Tools

The LangGraph agent acts as an intelligent orchestrator between the field rep's natural language inputs and the CRM backend. It reasons over conversation history to decide which tool to call.

### Tool 1 – `log_interaction`
Captures a complete HCP interaction record from structured or conversational input. Uses the LLM to perform entity extraction (HCP name, topics, sentiment signals) from free-text descriptions before persisting to the database.

**Flow:** User message → LLM parses intent → tool extracts fields → INSERT to DB → returns `interaction_id`

### Tool 2 – `edit_interaction`
Allows modification of any field in a previously logged interaction by its ID. Only updates explicitly provided fields (partial update pattern), preserving all other data.

**Flow:** User says "update interaction 5, change sentiment to positive" → LLM maps intent → tool patches only `sentiment` field → returns updated record summary

### Tool 3 – `summarize_topics`
Uses `llama-3.3-70b-versatile` to transform raw, unstructured meeting notes or voice transcripts into professionally structured CRM entries. Extracts: clinical topics, product mentions, HCP concerns, and efficacy data discussed.

**Flow:** Raw notes → LLM prompt → structured JSON with `summary`, `key_topics`, `products_mentioned`, `hcp_concerns`

### Tool 4 – `suggest_followups`
Generates context-aware, prioritized follow-up actions based on the interaction details and sentiment. Returns immediate actions (24h), weekly actions, materials to send, and next meeting agenda suggestions.

**Flow:** Interaction context → LLM sales coach prompt → JSON with `immediate_actions`, `weekly_actions`, `materials_to_send`, `next_meeting_agenda`

### Tool 5 – `analyze_sentiment`
Infers HCP sentiment from a natural language description of their behavior, body language, or verbal responses. Returns sentiment classification, confidence score, engagement level, receptiveness, and key signals.

**Flow:** Description text → LLM analysis prompt → JSON with `sentiment`, `confidence`, `engagement_level`, `receptiveness`, `key_signals`

---

## 📁 Project Structure

```
hcp-crm/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env.example
│   ├── agents/
│   │   └── hcp_agent.py         # LangGraph graph + 5 tools
│   ├── db/
│   │   └── database.py          # SQLAlchemy models + session
│   ├── models/
│   │   └── schemas.py           # Pydantic request/response schemas
│   └── routers/
│       ├── interactions.py      # CRUD endpoints
│       └── agent.py             # /api/agent/chat endpoint
│
├── frontend/
│   ├── public/index.html
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── App.js               # Main UI: Form + Chat panels
│       ├── api/index.js         # Axios API service layer
│       ├── store/index.js       # Redux store + slices
│       └── styles/main.css      # Full design system (Inter font)
│
├── docker-compose.yml
└── README.md
```

---

## 🚀 Setup & Running

### Prerequisites
- Node.js 18+
- Python 3.10+
- Groq API Key (free at https://console.groq.com)

### 1. Clone & Configure

```bash
git clone https://github.com/YOUR_USERNAME/hcp-crm.git
cd hcp-crm
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set your GROQ_API_KEY

# Run the server
uvicorn main:app --reload --port 8000
```

Backend runs at: `http://localhost:8000`  
API Docs: `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm start
```

Frontend runs at: `http://localhost:3000`

---

## 🐳 Docker Compose (Full Stack)

```bash
# From project root
docker-compose up --build
```

Services:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

---

## 🔑 Environment Variables

```env
# backend/.env
GROQ_API_KEY=your_groq_api_key_here
DATABASE_URL=sqlite:///./hcp_crm.db
# For PostgreSQL:
# DATABASE_URL=postgresql://user:password@localhost:5432/hcp_crm
```

---

## 🖥️ Features

| Feature | Description |
|---|---|
| **Dual Input Mode** | Log via structured form OR conversational chat |
| **LangGraph Agent** | Orchestrates 5 specialized tools with reasoning |
| **AI Summarization** | Converts raw notes to structured CRM entries |
| **Sentiment Analysis** | Infers HCP mood from natural language |
| **Follow-up Engine** | AI-generated next-best-action recommendations |
| **Redux State** | Full form state management with persistence |
| **REST API** | Full CRUD for interactions via FastAPI |
| **Auto Form Fill** | Chat responses auto-populate form fields |

---

## 📡 API Endpoints

```
POST   /api/interactions/         Create interaction
GET    /api/interactions/         List all interactions
GET    /api/interactions/{id}     Get single interaction
PUT    /api/interactions/{id}     Update interaction
DELETE /api/interactions/{id}     Delete interaction

POST   /api/agent/chat            Chat with LangGraph agent
GET    /health                    Health check
```

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Redux Toolkit, Axios |
| Styling | CSS Variables, Google Inter Font |
| Backend | Python 3.10, FastAPI, Uvicorn |
| AI Agent | LangGraph, LangChain |
| LLMs | Groq: gemma2-9b-it, llama-3.3-70b-versatile |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | SQLAlchemy 2.0 |

---

## 💡 Sample Chat Commands

```
"Met Dr. Sharma today, discussed OncoBoost Phase III data, she seemed very interested, shared the brochure"

"Summarize: long meeting with Dr. Patel, he had concerns about side effects, we talked about the clinical data..."

"Analyze sentiment: Dr. Gupta was nodding but kept checking his phone and asked few questions"

"Suggest follow-ups for a positive meeting about Product X efficacy with Dr. Mehta"

"Edit interaction 3, update sentiment to positive and add follow-up: send Phase III PDF"
```

---

## 📝 License
MIT
