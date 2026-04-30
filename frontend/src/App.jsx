import React, { useState, useRef } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, updateField, resetForm, setLoading, setLastSaved } from './store';
import { interactionAPI, agentAPI } from './api';
import './styles/main.css';

const SentimentRadio = ({ value, onChange }) => {
  const options = [
    { value: 'positive', emoji: '😊', label: 'Positive' },
    { value: 'neutral', emoji: '😐', label: 'Neutral' },
    { value: 'negative', emoji: '😟', label: 'Negative' },
  ];
  return (
    <div className="sentiment-group">
      {options.map(opt => (
        <label key={opt.value} className={`sentiment-option ${value === opt.value ? 'selected' : ''}`}>
          <input type="radio" name="sentiment" value={opt.value} checked={value === opt.value} onChange={() => onChange(opt.value)} />
          <span className="emoji">{opt.emoji}</span>
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
};

const ChatBubble = ({ msg }) => (
  <div className={`bubble ${msg.role}`}>
    {msg.role === 'assistant' && <div className="bubble-avatar">AI</div>}
    <div className="bubble-content">
      <p>{msg.content}</p>
      {msg.suggestions?.length > 0 && (
        <div className="suggestions">
          {msg.suggestions.map((s, i) => <span key={i} className="suggestion-chip">• {s}</span>)}
        </div>
      )}
    </div>
  </div>
);

// ── Smart extractor: reads user message and fills ALL form fields ──
const extractAllFields = (userInput) => {
  const extracted = {};
  const text = userInput;

  // 1. HCP NAME — Dr./Doctor patterns
  const drMatch = text.match(/(?:Dr\.?|Doctor|doctor|dr\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (drMatch) extracted.hcp_name = 'Dr. ' + drMatch[1];

  // 2. INTERACTION TYPE
  if (/called|phone call|telephonic|rang/i.test(text)) extracted.interaction_type = 'Call';
  else if (/email|emailed|wrote to/i.test(text)) extracted.interaction_type = 'Email';
  else if (/demo|demonstration|showed product|product demo/i.test(text)) extracted.interaction_type = 'Product Demo';
  else if (/conference|seminar|webinar|event|congress/i.test(text)) extracted.interaction_type = 'Conference';
  else if (/medical education|cme|training/i.test(text)) extracted.interaction_type = 'Medical Education';
  else if (/met|meeting|visited|visit|saw|seen/i.test(text)) extracted.interaction_type = 'Meeting';

  // 3. TOPICS DISCUSSED — "discussed X", "talked about X", "regarding X", "about X"
  const topicPatterns = [
    /discussed\s+(?:the\s+)?([^,\.;]+?)(?:\s*,|\s+and\s+(?:she|he|they|the|i|we)|$)/i,
    /talked about\s+(?:the\s+)?([^,\.;]+?)(?:\s*,|$)/i,
    /regarding\s+(?:the\s+)?([^,\.;]+?)(?:\s*,|$)/i,
    /topic(?:s)? (?:was|were|included?)\s+([^,\.;]+?)(?:\s*,|$)/i,
    /(?:we\s+)?(?:covered|reviewed|presented)\s+(?:the\s+)?([^,\.;]+?)(?:\s*,|$)/i,
  ];
  for (const pat of topicPatterns) {
    const m = text.match(pat);
    if (m && m[1] && m[1].trim().length > 2) {
      extracted.topics_discussed = m[1].trim();
      break;
    }
  }

  // 4. ATTENDEES — "with X", "along with X", "joined by X", "accompanied by X"
  const attendeePatterns = [
    /(?:along with|joined by|accompanied by|attended by)\s+([A-Z][a-zA-Z\s,&]+?)(?:\s+(?:and discussed|to discuss|for|about|we|\.)|$)/i,
    /met with\s+(?:Dr\.?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s+and\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?))?/i,
    /attendees?\s*(?:were|was|included?|:)\s*([A-Za-z\s,&]+?)(?:\.|,\s*(?:we|and\s+(?:the|i|she|he)))/i,
  ];
  for (const pat of attendeePatterns) {
    const m = text.match(pat);
    if (m && m[1] && m[1].trim().length > 1) {
      extracted.attendees = m[1].trim();
      break;
    }
  }

  // 5. MATERIALS SHARED — "shared X", "gave X brochure/pdf/material", "provided X"
  const matKeywords = 'brochure|pdf|material|leaflet|document|report|data|flyer|literature|poster|slide|presentation|pamphlet|study|paper|article|dossier|kit';
  const matPatterns = [
    new RegExp(`shared\\s+(?:the\\s+|a\\s+|an\\s+)?([^,\\.;]*(?:${matKeywords})[^,\\.;]*)`, 'i'),
    new RegExp(`gave\\s+(?:him|her|them|the doctor)?\\s*(?:the\\s+|a\\s+)?([^,\\.;]*(?:${matKeywords})[^,\\.;]*)`, 'i'),
    new RegExp(`provided\\s+(?:the\\s+|a\\s+)?([^,\\.;]*(?:${matKeywords})[^,\\.;]*)`, 'i'),
    new RegExp(`distributed\\s+(?:the\\s+|a\\s+)?([^,\\.;]*(?:${matKeywords})[^,\\.;]*)`, 'i'),
    new RegExp(`handed\\s+(?:over\\s+)?(?:the\\s+|a\\s+)?([^,\\.;]*(?:${matKeywords})[^,\\.;]*)`, 'i'),
  ];
  for (const pat of matPatterns) {
    const m = text.match(pat);
    if (m && m[1] && m[1].trim().length > 1) {
      extracted.materials_shared = m[1].trim();
      break;
    }
  }

  // 6. SAMPLES DISTRIBUTED — "gave X samples", "distributed samples of X"
  const samplePatterns = [
    /(?:gave|distributed|provided|left|dropped|handed)\s+(?:him|her|them|the doctor)?\s*([^,\.;]*sample[^,\.;]*)/i,
    /sample(?:s)?\s+of\s+([^,\.;]+)/i,
    /([^,\.;]*sample[^,\.;]*)\s+(?:was|were)\s+(?:given|distributed|provided)/i,
  ];
  for (const pat of samplePatterns) {
    const m = text.match(pat);
    if (m) {
      extracted.samples_distributed = (m[1] || m[0]).trim();
      break;
    }
  }

  // 7. SENTIMENT — keywords
  if (/very positive|extremely positive|highly positive|loved it|excited|enthusiastic|great response|very happy/i.test(text)) {
    extracted.sentiment = 'positive';
  } else if (/positive|happy|pleased|interested|receptive|good response|liked|impressed|keen|supportive|cancer positive/i.test(text)) {
    extracted.sentiment = 'positive';
  } else if (/negative|unhappy|resistant|rejected|not interested|refused|annoyed|upset|angry|disappointed/i.test(text)) {
    extracted.sentiment = 'negative';
  } else if (/neutral|okay|moderate|mixed|unsure|undecided|neither/i.test(text)) {
    extracted.sentiment = 'neutral';
  }

  // 8. OUTCOMES — "she agreed", "he said", "outcome was", "result was", "they decided", "commitment"
  const outcomePatterns = [
    /(?:she|he|they|doctor|hcp|dr\.\s*\w+)\s+(?:agreed|committed|confirmed|said she would|said he would|will|promised|accepted)\s+(?:to\s+)?([^,\.;]+)/i,
    /outcome(?:s)?\s*(?:was|were|:|include[sd]?)\s*([^,\.;]+)/i,
    /(?:result|conclusion|agreement|decision)\s*(?:was|:)\s*([^,\.;]+)/i,
    /(?:agreed to|decided to|committed to)\s+([^,\.;]+)/i,
    /will\s+(?:consider|prescribe|review|look into|try|recommend)\s+([^,\.;]+)/i,
  ];
  for (const pat of outcomePatterns) {
    const m = text.match(pat);
    if (m && m[1] && m[1].trim().length > 2) {
      extracted.outcomes = m[1].trim();
      break;
    }
  }

  return extracted;
};

const FormPanel = ({ onSave }) => {
  const dispatch = useDispatch();
  const form = useSelector(s => s.interaction.form);
  const loading = useSelector(s => s.interaction.loading);
  const lastSaved = useSelector(s => s.interaction.lastSaved);
  const field = (name) => ({ value: form[name], onChange: (e) => dispatch(updateField({ field: name, value: e.target.value })) });
  const types = ['Meeting', 'Call', 'Email', 'Conference', 'Product Demo', 'Medical Education'];

  return (
    <div className="form-panel">
      <div className="panel-header">
        <h2>Interaction Details</h2>
        {lastSaved && <span className="saved-badge">✓ Saved (ID: {lastSaved})</span>}
      </div>
      <div className="form-grid-2">
        <div className="field-group">
          <label>HCP Name</label>
          <input placeholder="Search or select HCP..." {...field('hcp_name')} />
        </div>
        <div className="field-group">
          <label>Interaction Type</label>
          <div className="select-wrap">
            <select {...field('interaction_type')}>
              {types.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="form-grid-2">
        <div className="field-group">
          <label>Date</label>
          <input type="date" {...field('date')} />
        </div>
        <div className="field-group">
          <label>Time</label>
          <input type="time" {...field('time')} />
        </div>
      </div>
      <div className="field-group">
        <label>Attendees</label>
        <input placeholder="Enter names or search..." {...field('attendees')} />
      </div>
      <div className="field-group">
        <label>Topics Discussed</label>
        <textarea rows={3} placeholder="Enter key discussion points..." {...field('topics_discussed')} />
      </div>
      <div className="materials-section">
        <h3>Materials Shared / Samples Distributed</h3>
        <div className="materials-card">
          <div className="materials-row">
            <span className="mat-label">Materials Shared</span>
            <button className="add-btn">+ Search/Add</button>
          </div>
          <input
            placeholder="No materials added."
            value={form.materials_shared}
            onChange={e => dispatch(updateField({ field: 'materials_shared', value: e.target.value }))}
            className="mat-field"
          />
        </div>
        <div className="materials-card">
          <div className="materials-row">
            <span className="mat-label">Samples Distributed</span>
            <button className="add-btn">+ Add Sample</button>
          </div>
          <input
            placeholder="No samples added."
            value={form.samples_distributed}
            onChange={e => dispatch(updateField({ field: 'samples_distributed', value: e.target.value }))}
            className="mat-field"
          />
        </div>
      </div>
      <div className="field-group">
        <label>Observed/Inferred HCP Sentiment</label>
        <SentimentRadio value={form.sentiment} onChange={(v) => dispatch(updateField({ field: 'sentiment', value: v }))} />
      </div>
      <div className="field-group">
        <label>Outcomes</label>
        <textarea rows={3} placeholder="Key outcomes or agreements..." {...field('outcomes')} />
      </div>
      <div className="field-group">
        <label>Follow-up Actions</label>
        <textarea rows={3} placeholder="Enter next steps or tasks..." {...field('follow_up_actions')} />
        <div className="ai-suggestions">
          <p className="suggestion-label">★ AI Suggested Follow-ups:</p>
          <ul>
            <li>Schedule follow-up meeting in 2 weeks</li>
            <li>Send OncoBoost Phase III PDF</li>
            <li>Add Dr. Sharma to advisory board invite list</li>
          </ul>
        </div>
      </div>
      <div className="form-actions">
        <button className="btn-ghost" onClick={() => dispatch(resetForm())}>↺ Reset</button>
        <button className="btn-primary" onClick={onSave} disabled={loading || !form.hcp_name}>
          {loading ? 'Saving...' : '✓ Log Interaction'}
        </button>
      </div>
    </div>
  );
};

const ChatPanel = () => {
  const dispatch = useDispatch();
  const form = useSelector(s => s.interaction.form);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Log interaction details here (e.g., "Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure") or ask for help.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const bottomRef = useRef(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userInput = input;
    setMessages(prev => [...prev, { role: 'user', content: userInput }]);
    setInput('');
    setLoading(true);

    // Immediately extract fields from user message and fill form
    const localExtracted = extractAllFields(userInput);
    Object.entries(localExtracted).forEach(([field, value]) => {
      if (value) dispatch(updateField({ field, value }));
    });

    try {
      const res = await agentAPI.chat(userInput, sessionId, form);
      const data = res.data;

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        suggestions: data.follow_up_suggestions,
      }]);

      // Also apply any structured data from AI response
      if (data.extracted_data?.sentiment_analysis?.sentiment) {
        dispatch(updateField({ field: 'sentiment', value: data.extracted_data.sentiment_analysis.sentiment }));
      }
      if (data.extracted_data?.structured_summary?.summary) {
        const current = form.topics_discussed;
        if (!current) dispatch(updateField({ field: 'topics_discussed', value: data.extracted_data.structured_summary.summary }));
      }
      if (data.follow_up_suggestions?.length) {
        dispatch(updateField({ field: 'follow_up_actions', value: data.follow_up_suggestions.join('\n') }));
      }
      if (data.interaction_id) {
        dispatch(setLastSaved(data.interaction_id));
      }

      // Extract from AI reply text too for HCP name if not already found
      if (!localExtracted.hcp_name && data.reply) {
        const replyDr = data.reply.match(/(?:Dr\.?|Doctor)\s+([A-Z][a-z]+)/);
        if (replyDr) dispatch(updateField({ field: 'hcp_name', value: 'Dr. ' + replyDr[1] }));
      }
      // Extract outcomes from AI reply if not already found
      if (!localExtracted.outcomes && data.reply) {
        const outcomeInReply = data.reply.match(/(?:outcome|agreed|will|committed)[:\s]+([^\.]{10,80})/i);
        if (outcomeInReply) dispatch(updateField({ field: 'outcomes', value: outcomeInReply[1].trim() }));
      }

    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Backend not connected. Run the FastAPI server to enable AI features.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  const quickPrompts = ['Summarize my meeting notes', 'Analyze HCP sentiment', 'Suggest follow-ups', 'Log this interaction'];

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="ai-badge"><span className="ai-dot" /> AI Assistant</div>
        <p className="chat-subtitle">Log interaction via chat</p>
      </div>
      <div className="chat-messages">
        {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
        {loading && (
          <div className="bubble assistant">
            <div className="bubble-avatar">AI</div>
            <div className="bubble-content typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="quick-prompts">
        {quickPrompts.map(p => <button key={p} className="quick-chip" onClick={() => setInput(p)}>{p}</button>)}
      </div>
      <div className="chat-input-row">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Describe interaction..." />
        <button className="send-btn" onClick={send} disabled={loading || !input.trim()}>➤ Log</button>
      </div>
    </div>
  );
};

function AppInner() {
  const dispatch = useDispatch();
  const form = useSelector(s => s.interaction.form);
  const [tab, setTab] = useState('log');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const handleSave = async () => {
    if (!form.hcp_name) return showToast('HCP name is required', 'error');
    dispatch(setLoading(true));
    try {
      const res = await interactionAPI.create(form);
      dispatch(setLastSaved(res.data.id));
      showToast(`Interaction with ${form.hcp_name} logged successfully!`);
    } catch {
      showToast('Failed to save. Check your backend connection.', 'error');
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo"><span className="logo-dot" /><span>PharmaConnect <em>CRM</em></span></div>
          <nav className="header-nav">
            {['log', 'history'].map(t => (
              <button key={t} className={`nav-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'log' ? 'Log Interaction' : 'History'}
              </button>
            ))}
          </nav>
        </div>
        <div className="header-right">
          <span className="agent-status"><span className="pulse" />LangGraph Agent Active</span>
        </div>
      </header>
      <main className="app-main">
        {tab === 'log' && (
          <>
            <div className="screen-title">
              <h1>Log HCP Interaction</h1>
              <p>Capture details via structured form or conversational AI</p>
            </div>
            <div className="split-layout">
              <FormPanel onSave={handleSave} />
              <ChatPanel />
            </div>
          </>
        )}
        {tab === 'history' && (
          <div className="history-panel">
            <h3>Recent Interactions</h3>
            <p className="empty-state">No interactions logged yet.</p>
          </div>
        )}
      </main>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

export default function App() {
  return <Provider store={store}><AppInner /></Provider>;
}