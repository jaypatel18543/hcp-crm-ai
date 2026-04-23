import React, { useState, useEffect, useRef } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, updateField, setForm, resetForm, setLoading, setLastSaved } from './store';
import { interactionAPI, agentAPI } from './api';
import './styles/main.css';

// ── Icons (inline SVG to avoid dependency issues) ──
const Icon = ({ name, size = 16 }) => {
  const icons = {
    user: (
  <>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </>
),
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    send: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    bot: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><line x1="12" y1="3" x2="12" y2="11"/></>,
    check: <polyline points="20 6 9 17 4 12"/>,
    refresh: <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    sparkle: <><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></>,
    chevron: <polyline points="6 9 12 15 18 9"/>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    mic: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    save: <><path d="M19 21H5a2 2 0 0 0-2 2H3V5a2 2 0 0 0 2-2h11l5 5v11a2 2 0 0 0-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// ── Sentiment Radio ──
const SentimentRadio = ({ value, onChange }) => {
  const options = [
    { value: 'positive', emoji: '😊', label: 'Positive', color: '#22c55e' },
    { value: 'neutral', emoji: '😐', label: 'Neutral', color: '#f59e0b' },
    { value: 'negative', emoji: '😟', label: 'Negative', color: '#ef4444' },
  ];
  return (
    <div className="sentiment-group">
      {options.map(opt => (
        <label key={opt.value} className={`sentiment-option ${value === opt.value ? 'selected' : ''}`} style={{ '--accent': opt.color }}>
          <input type="radio" name="sentiment" value={opt.value} checked={value === opt.value} onChange={() => onChange(opt.value)} />
          <span className="emoji">{opt.emoji}</span>
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
};

// ── Chat Bubble ──
const ChatBubble = ({ msg }) => (
  <div className={`bubble ${msg.role}`}>
    {msg.role === 'assistant' && (
      <div className="bubble-avatar"><Icon name="bot" size={14} /></div>
    )}
    <div className="bubble-content">
      <p>{msg.content}</p>
      {msg.suggestions?.length > 0 && (
        <div className="suggestions">
          {msg.suggestions.map((s, i) => (
            <span key={i} className="suggestion-chip">• {s}</span>
          ))}
        </div>
      )}
    </div>
  </div>
);

// ── Main Form Panel ──
const FormPanel = ({ onSave }) => {
  const dispatch = useDispatch();
  const form = useSelector(s => s.interaction.form);
  const loading = useSelector(s => s.interaction.loading);
  const lastSaved = useSelector(s => s.interaction.lastSaved);

  const field = (name) => ({
    value: form[name],
    onChange: (e) => dispatch(updateField({ field: name, value: e.target.value })),
  });

  const types = ['Meeting', 'Call', 'Email', 'Conference', 'Product Demo', 'Medical Education'];

  return (
    <div className="form-panel">
      <div className="panel-header">
        <h2>Interaction Details</h2>
        {lastSaved && <span className="saved-badge"><Icon name="check" size={12} /> Saved</span>}
      </div>

      <div className="form-grid-2">
        <div className="field-group">
          <label>HCP Name</label>
          <div className="input-wrap">
            <Icon name="user" size={15} />
            <input placeholder="Search or select HCP..." {...field('hcp_name')} />
          </div>
        </div>
        <div className="field-group">
          <label>Interaction Type</label>
          <div className="select-wrap">
            <select {...field('interaction_type')}>
              {types.map(t => <option key={t}>{t}</option>)}
            </select>
            <Icon name="chevron" size={15} />
          </div>
        </div>
      </div>

      <div className="form-grid-2">
        <div className="field-group">
          <label>Date</label>
          <div className="input-wrap">
            <Icon name="calendar" size={15} />
            <input type="date" {...field('date')} />
          </div>
        </div>
        <div className="field-group">
          <label>Time</label>
          <div className="input-wrap">
            <Icon name="clock" size={15} />
            <input type="time" {...field('time')} />
          </div>
        </div>
      </div>

      <div className="field-group">
        <label>Attendees</label>
        <input placeholder="Enter names or search..." {...field('attendees')} />
      </div>

      <div className="field-group">
        <label>Topics Discussed</label>
        <div className="textarea-wrap">
          <textarea rows={4} placeholder="Enter key discussion points..." {...field('topics_discussed')} />
          <button className="voice-btn" title="Voice input">
            <Icon name="mic" size={14} />
          </button>
        </div>
        <button className="summarize-btn">
          <Icon name="sparkle" size={14} />
          Summarize from Voice Note (Requires Consent)
        </button>
      </div>

      <div className="materials-section">
        <h3>Materials Shared / Samples Distributed</h3>
        <div className="materials-card">
          <div className="materials-row">
            <span className="mat-label">Materials Shared</span>
            <button className="add-btn"><Icon name="plus" size={14} /> Search/Add</button>
          </div>
          <textarea rows={2} placeholder="No materials added." {...field('materials_shared')} className="mat-input" />
        </div>
        <div className="materials-card">
          <div className="materials-row">
            <span className="mat-label">Samples Distributed</span>
            <button className="add-btn"><Icon name="plus" size={14} /> Add Sample</button>
          </div>
          <textarea rows={2} placeholder="No samples added." {...field('samples_distributed')} className="mat-input" />
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
          <p className="suggestion-label"><Icon name="sparkle" size={12} /> AI Suggested Follow-ups:</p>
          <ul>
            <li>Schedule follow-up meeting in 2 weeks</li>
            <li>Send OncoBoost Phase III PDF</li>
            <li>Add Dr. Sharma to advisory board invite list</li>
          </ul>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn-ghost" onClick={() => dispatch(resetForm())}>
          <Icon name="refresh" size={15} /> Reset
        </button>
        <button className="btn-primary" onClick={onSave} disabled={loading || !form.hcp_name}>
          {loading ? 'Saving...' : <><Icon name="save" size={15} /> Log Interaction</>}
        </button>
      </div>
    </div>
  );
};

// ── AI Chat Panel ──
const ChatPanel = () => {
  const dispatch = useDispatch();
  const form = useSelector(s => s.interaction.form);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Log interaction details here (e.g., "Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure") or ask for help.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await agentAPI.chat(input, sessionId, form);
      const data = res.data;
      const asstMsg = {
        role: 'assistant',
        content: data.reply,
        suggestions: data.follow_up_suggestions,
      };
      setMessages(prev => [...prev, asstMsg]);

      // Auto-populate form if agent extracted data
      if (data.extracted_data?.structured_summary) {
        const s = data.extracted_data.structured_summary;
        if (s.summary) dispatch(updateField({ field: 'topics_discussed', value: s.summary }));
      }
      if (data.extracted_data?.sentiment_analysis?.sentiment) {
        dispatch(updateField({ field: 'sentiment', value: data.extracted_data.sentiment_analysis.sentiment }));
      }
      if (data.follow_up_suggestions?.length) {
        dispatch(updateField({ field: 'follow_up_actions', value: data.follow_up_suggestions.join('\n') }));
      }
      if (data.interaction_id) {
        dispatch(setLastSaved(data.interaction_id));
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Backend not connected. Run the FastAPI server to enable AI features.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const quickPrompts = [
    "Summarize my meeting notes",
    "Analyze HCP sentiment",
    "Suggest follow-ups",
    "Log this interaction",
  ];

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="ai-badge">
          <span className="ai-dot" />
          AI Assistant
        </div>
        <p className="chat-subtitle">Log interaction via chat</p>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
        {loading && (
          <div className="bubble assistant">
            <div className="bubble-avatar"><Icon name="bot" size={14} /></div>
            <div className="bubble-content typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="quick-prompts">
        {quickPrompts.map(p => (
          <button key={p} className="quick-chip" onClick={() => setInput(p)}>{p}</button>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Describe interaction..."
        />
        <button className="send-btn" onClick={send} disabled={loading || !input.trim()}>
          <Icon name="send" size={16} />
          Log
        </button>
      </div>
    </div>
  );
};

// ── History Panel ──
const HistoryPanel = ({ interactions }) => (
  <div className="history-panel">
    <h3>Recent Interactions</h3>
    {interactions.length === 0 && <p className="empty-state">No interactions logged yet.</p>}
    {interactions.map(int => (
      <div key={int.id} className="history-card">
        <div className="hist-top">
          <strong>{int.hcp_name}</strong>
          <span className={`hist-badge ${int.sentiment}`}>{int.sentiment}</span>
        </div>
        <p className="hist-type">{int.interaction_type} · {int.date}</p>
        <p className="hist-topics">{int.topics_discussed?.slice(0, 80) || 'No topics noted'}...</p>
      </div>
    ))}
  </div>
);

// ── App Shell ──
function AppInner() {
  const dispatch = useDispatch();
  const form = useSelector(s => s.interaction.form);
  const interactions = useSelector(s => s.interaction.interactions);
  const [tab, setTab] = useState('log');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

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
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-dot" />
            <span>PharmaConnect <em>CRM</em></span>
          </div>
          <nav className="header-nav">
            {['log', 'history'].map(t => (
              <button key={t} className={`nav-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'log' ? 'Log Interaction' : 'History'}
              </button>
            ))}
          </nav>
        </div>
        <div className="header-right">
          <span className="agent-status">
            <span className="pulse" />
            LangGraph Agent Active
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {tab === 'log' ? (
          <div className="screen-title">
            <h1>Log HCP Interaction</h1>
            <p>Capture details via structured form or conversational AI</p>
          </div>
        ) : null}

        {tab === 'log' && (
          <div className="split-layout">
            <FormPanel onSave={handleSave} />
            <ChatPanel />
          </div>
        )}
        {tab === 'history' && <HistoryPanel interactions={interactions} />}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          <Icon name={toast.type === 'success' ? 'check' : 'x'} size={14} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppInner />
    </Provider>
  );
}
