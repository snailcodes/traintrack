const { useState, useEffect } = React;

function TrainerApp() {
  const [clients, setClients]   = useState([]);
  const [sessions, setSessions] = useState({});
  const [view, setView]         = useState('clients'); // clients | addClient | session
  const [currentClient, setCurrentClient]   = useState(null);
  const [exercises, setExercises]           = useState([]);
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [exerciseName, setExerciseName]     = useState('');
  const [exerciseOptions, setExerciseOptions] = useState([]);
  const [showDropdown, setShowDropdown]     = useState(false);
  const [dropdownIndex, setDropdownIndex]   = useState(-1);
  const [timers, setTimers] = useState({}); // { exerciseId: { start: timestamp, interval: intervalId } }
  const [sessionTab, setSessionTab] = useState('today'); // 'today' | 'history' | 'summary'
  const [focusedExercise, setFocusedExercise] = useState(null); // track which exercise is focused/hovered
  const [sessionDate, setSessionDate]       = useState(today());
  const [toast, setToast] = useState({ show: false, msg: '', ok: true });

  const [cf, setCf] = useState({ name:'', age:'', goal:'', startDate: today() });
  const [clientSearch, setClientSearch] = useState('');

  function today() { return new Date().toISOString().split('T')[0]; }

  useEffect(() => {
    try {
      const c = localStorage.getItem('tt_clients');
      const s = localStorage.getItem('tt_sessions');
      if (c) setClients(JSON.parse(c));
      if (s) setSessions(JSON.parse(s));
    } catch(e) {}
    
    // Cleanup timers on unmount
    return () => {
      Object.values(timers).forEach(t => t.interval && clearInterval(t.interval));
    };
  }, []);

  function save(c, s) {
    if (c !== undefined) { setClients(c); localStorage.setItem('tt_clients', JSON.stringify(c)); }
    if (s !== undefined) { setSessions(s); localStorage.setItem('tt_sessions', JSON.stringify(s)); }
  }

  function toast_(msg, ok = true) {
    setToast({ show: true, msg, ok });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 2500);
  }

  // ── Exercise search ──
  const EXERCISES = [
    'Bench Press','Squat','Deadlift','Overhead Press','Barbell Row','Pull-ups','Chin-ups','Dips',
    'Lunges','Leg Press','Lat Pulldown','Cable Row','Dumbbell Press','Incline Press','Decline Press',
    'Front Squat','Romanian Deadlift','Leg Curl','Leg Extension','Calf Raise','Bicep Curl',
    'Tricep Extension','Lateral Raise','Face Pull','Shrugs','Plank','Crunches','Russian Twist',
    'Leg Raise','Mountain Climbers','Burpees','Jump Squat','Box Jump','Kettlebell Swing','Push-ups',
    'Hip Thrust','Glute Bridge','Bulgarian Split Squat','Step-ups',"Farmer's Walk",'Battle Ropes',
    'Rowing Machine','Treadmill','Elliptical','Cycling','Cable Fly','Pec Deck','Hammer Curl',
    'Preacher Curl','Skull Crusher','Arnold Press','Upright Row','Reverse Fly','Cable Crossover',
    'Hanging Leg Raise','Incline Curl','Spider Curl','Concentration Curl','Wrist Curl','Good Morning',
    'Sumo Deadlift','Trap Bar Deadlift','Hack Squat','Sissy Squat','Nordic Curl','GHR','Reverse Lunge'
  ];

  function search(term) {
    if (!term || term.length < 2) { setExerciseOptions([]); setShowDropdown(false); setDropdownIndex(-1); return; }
    const f = EXERCISES.filter(e => e.toLowerCase().includes(term.toLowerCase()));
    setExerciseOptions(f); setShowDropdown(f.length > 0); setDropdownIndex(-1);
  }

  // ── Get last session data for a given exercise name ──
  function getLastData(exName) {
    if (!currentClient) return null;
    const clientSessions = sessions[currentClient.id] || [];
    for (const s of clientSessions) {
      // Skip current session date
      if (s.date === sessionDate) continue;
      const found = s.exercises.find(e => e.name.toLowerCase() === exName.toLowerCase());
      if (found) {
        const parts = [];
        if (found.sets)     parts.push(`${found.sets} sets`);
        if (found.reps)     parts.push(`${found.reps} reps`);
        if (found.weight)   parts.push(`${found.weight} kg`);
        if (found.duration) parts.push(`${found.duration}s`);
        return {
          label: parts.join(' · ') || '—',
          date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          hasComment: !!(found.comment && found.comment.trim()),
          comment: found.comment,
          sessionId: s.id
        };
      }
    }
    return null;
  }

  // ── Add exercise row ──
  function addExRow() {
    if (!exerciseName.trim()) { toast_('Enter exercise name', false); return; }
    setExercises(prev => [...prev, {
      id: Date.now().toString(), name: exerciseName.trim(),
      sets: '', reps: '', weight: '', duration: '', comment: '', saved: false
    }]);
    setExerciseName(''); setShowDropdown(false);
  }

  function updateEx(id, field, val) {
    setExercises(prev => prev.map(e => e.id === id ? { ...e, [field]: val, saved: false } : e));
  }

  function saveEx(ex) {
    if (!ex.sets && !ex.reps && !ex.weight && !ex.duration && !ex.comment) {
      toast_('Fill at least one field', false); return;
    }
    const s = { ...sessions };
    if (!s[currentClient.id]) s[currentClient.id] = [];
    let day = s[currentClient.id].find(d => d.date === sessionDate);
    if (!day) {
      day = { id: `${sessionDate}_${currentClient.id}`, clientId: currentClient.id, date: sessionDate, exercises: [] };
      s[currentClient.id] = [day, ...s[currentClient.id]];
    }
    const saved = { id: ex.id, name: ex.name, sets: ex.sets||null, reps: ex.reps||null, weight: ex.weight||null, duration: ex.duration||null, comment: ex.comment||null };
    const i = day.exercises.findIndex(e => e.id === ex.id);
    if (i >= 0) day.exercises[i] = saved; else day.exercises.push(saved);
    save(undefined, s);
    setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, saved: true } : e));
    toast_('Saved!');
  }

  function deleteClient(id) {
    const newC = clients.filter(c => c.id !== id);
    const newS = { ...sessions }; delete newS[id];
    save(newC, newS); toast_('Client deleted');
  }

  function deleteSession(clientId, sessionId) {
    const newS = { ...sessions };
    newS[clientId] = newS[clientId].filter(s => s.id !== sessionId);
    save(undefined, newS); toast_('Session deleted');
  }

  function toggleExpand(id) {
    const s = new Set(expandedSessions);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedSessions(s);
  }

  function startTimer(exId) {
    const start = Date.now();
    const interval = setInterval(() => {
      setTimers(prev => ({ ...prev, [exId]: { ...prev[exId], elapsed: Math.floor((Date.now() - start) / 1000) } }));
    }, 100);
    setTimers(prev => ({ ...prev, [exId]: { start, interval, elapsed: 0 } }));
  }

  function stopTimer(exId) {
    const timer = timers[exId];
    if (!timer) return;
    clearInterval(timer.interval);
    const elapsed = Math.floor((Date.now() - timer.start) / 1000);
    setTimers(prev => {
      const next = { ...prev };
      delete next[exId];
      return next;
    });
    updateEx(exId, 'duration', elapsed);
  }

  function getExerciseSummary() {
    if (!currentClient || !sessions[currentClient.id]) return [];
    const clientSessions = sessions[currentClient.id];
    const exerciseMap = {}; // { exerciseName: { count, latest, best } }
    
    clientSessions.forEach(session => {
      session.exercises.forEach(ex => {
        const name = ex.name;
        if (!exerciseMap[name]) {
          exerciseMap[name] = {
            name,
            count: 0,
            latest: null,
            best: null
          };
        }
        
        exerciseMap[name].count++;
        
        // Latest = most recent performance
        if (!exerciseMap[name].latest || session.date > exerciseMap[name].latest.date) {
          exerciseMap[name].latest = {
            date: session.date,
            sets: ex.sets || 0,
            reps: ex.reps || 0,
            weight: ex.weight || 0,
            duration: ex.duration || 0,
            comment: ex.comment
          };
        }
        
        // Best = single best performance across all sessions
        // Priority: weight > reps > sets > duration
        const currentBest = exerciseMap[name].best;
        const isBetter = !currentBest ||
          (ex.weight && ex.weight > (currentBest.weight || 0)) ||
          (!ex.weight && ex.reps && ex.reps > (currentBest.reps || 0)) ||
          (!ex.weight && !ex.reps && ex.sets && ex.sets > (currentBest.sets || 0)) ||
          (!ex.weight && !ex.reps && !ex.sets && ex.duration && ex.duration > (currentBest.duration || 0));
        
        if (isBetter) {
          exerciseMap[name].best = {
            sets: ex.sets || 0,
            reps: ex.reps || 0,
            weight: ex.weight || 0,
            duration: ex.duration || 0
          };
        }
      });
    });
    
    return Object.values(exerciseMap).sort((a, b) => b.count - a.count);
  }

  function openSession(client) {
    setCurrentClient(client);
    setExercises([]);
    setSessionDate(today());
    setExpandedSessions(new Set());
    setSessionTab('today');
    setView('session');
  }

  function finalize() {
    setCurrentClient(null); setExercises([]);
    setView('clients'); toast_('Session complete ✓');
  }

  // ── Design tokens ──
  const C = {
    bg:      '#111318',
    surface: '#1C1F26',
    raised:  '#252830',
    border:  '#2E323C',
    accent:  '#FF4D00',
    accentDim: 'rgba(255,77,0,0.15)',
    cyan:    '#00D9FF',
    green:   '#00E676',
    text:    '#F0F2F5',
    muted:   '#6B7280',
    subtle:  '#9CA3AF',
  };

  const inputCss = {
    background: C.raised, border: `1.5px solid ${C.border}`, borderRadius: '8px',
    color: C.text, fontSize: '16px', fontFamily: 'DM Mono, monospace',
    padding: '0.6rem 0.75rem', width: '100%', boxSizing: 'border-box',
    outline: 'none', WebkitAppearance: 'none', appearance: 'none',
    caretColor: C.accent,
  };
  const btnA = { // accent
    background: C.accent, color: '#fff', border: 'none', borderRadius: '8px',
    fontFamily: "'DM Sans', sans-serif", fontWeight: '700', fontSize: '0.85rem',
    padding: '0.65rem 1.25rem', cursor: 'pointer', letterSpacing: '0.5px',
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', flexShrink: 0,
  };
  const btnG = { ...btnA, background: C.green, color: '#111' };
  const btnGhost = {
    ...btnA, background: 'transparent', color: C.muted,
    border: `1.5px solid ${C.border}`,
  };
  const btnDel = { ...btnA, background: 'transparent', color: '#EF4444', border: '1.5px solid #EF444433', padding: '0.4rem 0.7rem', fontSize: '0.72rem' };
  const cardCss = { background: C.surface, borderRadius: '14px', padding: '1.25rem', marginBottom: '0.75rem' };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html { -webkit-text-size-adjust: 100%; }
        body { margin: 0; background: ${C.bg}; touch-action: manipulation; }
        input, textarea { font-size: 16px !important; }
        input::placeholder, textarea::placeholder { color: ${C.muted}; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }

        .bebas { font-family: 'Bebas Neue', sans-serif; }
        .mono  { font-family: 'DM Mono', monospace; }

        .client-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
        .ex-row      { display: flex; gap: 0.5rem; align-items: center; flex-wrap: nowrap; }
        .ex-inputs   { display: flex; gap: 0.4rem; flex: 1; min-width: 0; }

        @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade { animation: slideUp 0.25s ease; }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .saving { animation: pulse 0.6s ease; }

        @media (max-width: 640px) {
          .ex-row     { flex-wrap: wrap; }
          .ex-name    { width: 100%; flex: none !important; margin-bottom: 0.5rem; }
          .ex-inputs  { flex-wrap: wrap; width: 100%; }
          .ex-num     { flex: 1 1 calc(25% - 0.3rem) !important; min-width: 60px !important; }
          .ex-comment { flex: 1 1 100% !important; margin-top: 0.4rem; }
          .client-grid { grid-template-columns: 1fr !important; }
        }
        
        /* Better touch targets on mobile */
        @media (max-width: 640px) {
          button { min-height: 44px; }
          input, textarea { min-height: 44px; }
        }
      `}</style>

      {/* ══════════════ HEADER ══════════════ */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '0.9rem 1.25rem', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
            {view !== 'clients' && (
              <button onClick={() => { setView('clients'); setCurrentClient(null); setExercises([]); }}
                style={{ ...btnGhost, padding: '0.4rem 0.75rem', fontSize: '0.8rem', marginRight: '0.25rem' }}>← Back</button>
            )}
            <span className="bebas" style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', letterSpacing: '2px', color: C.accent }}>TRAINTRACK</span>
            {currentClient && (
              <span style={{ color: C.muted, fontSize: '0.9rem', fontWeight: '500' }}>/ {currentClient.name}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {view === 'session' && (
              <button onClick={finalize} style={{ ...btnG, padding: '0.55rem 1rem', fontSize: '0.82rem' }}>✓ Done</button>
            )}
            <button onClick={() => setView(view === 'addClient' ? 'clients' : 'addClient')}
              style={{ ...btnA, padding: '0.55rem 1rem', fontSize: '0.82rem',
                background: view === 'addClient' ? C.border : C.accent }}>
              {view === 'addClient' ? 'Cancel' : '+ Client'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1rem' }}>

        {/* ══════════════ ADD CLIENT ══════════════ */}
        {view === 'addClient' && (
          <div style={{ ...cardCss }} className="fade">
            <h2 className="bebas" style={{ fontSize: '1.8rem', color: C.accent, margin: '0 0 1.25rem 0', letterSpacing: '1px' }}>NEW CLIENT</h2>
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem', fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Name *</label>
                <input value={cf.name} onChange={e => setCf(p=>({...p, name: e.target.value}))} style={inputCss} placeholder="Full name" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem', fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Age</label>
                  <input type="number" value={cf.age} onChange={e => setCf(p=>({...p, age: e.target.value}))} style={inputCss} placeholder="—" min="1" max="120" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem', fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Start Date *</label>
                  <input type="date" value={cf.startDate} onChange={e => setCf(p=>({...p, startDate: e.target.value}))} style={inputCss} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem', fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Goal</label>
                <textarea value={cf.goal} onChange={e => setCf(p=>({...p, goal: e.target.value}))} style={{ ...inputCss, minHeight: '70px', resize: 'vertical' }} placeholder="e.g. Lose 10kg, Build muscle..." />
              </div>
              <button type="button" style={{ ...btnA, width: '100%', padding: '0.85rem', fontSize: '0.95rem' }}
                onClick={() => {
                  if (!cf.name || !cf.startDate) { toast_('Name & start date required', false); return; }
                  const client = { id: Date.now().toString(), ...cf };
                  save([...clients, client].sort((a,b) => a.name.localeCompare(b.name)), undefined);
                  setCf({ name:'', age:'', goal:'', startDate: today() });
                  toast_(`${cf.name} added!`);
                  setView('clients');
                }}>ADD CLIENT</button>
            </div>
          </div>
        )}

        {/* ══════════════ CLIENT LIST ══════════════ */}
        {view === 'clients' && (
          <div className="fade">
            {/* Search bar */}
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Search clients..."
                style={{ ...inputCss, fontSize: '0.95rem' }}
              />
            </div>
            {clients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: C.muted }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🏋️</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '600', color: C.subtle, marginBottom: '0.4rem' }}>No clients yet</div>
                <div style={{ fontSize: '0.88rem' }}>Tap "+ Client" to add your first</div>
              </div>
            ) : (() => {
              const filtered = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
              return filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 2rem', color: C.muted }}>
                  <div style={{ fontSize: '0.95rem' }}>No clients match "{clientSearch}"</div>
                </div>
              ) : (
              <div className="client-grid">
                {filtered.map(client => (
                  <div key={client.id} onClick={() => openSession(client)}
                    style={{ ...cardCss, marginBottom: 0, cursor: 'pointer', border: `1.5px solid ${C.border}`, transition: 'border-color 0.2s', position: 'relative' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: '700', color: C.text }}>{client.name}</span>
                      <button onClick={e => { e.stopPropagation(); deleteClient(client.id); }} style={btnDel}>del</button>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: C.muted, display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.75rem' }}>
                      {client.age && <span>Age {client.age}</span>}
                      {client.goal && <span style={{ color: C.subtle }}>{client.goal}</span>}
                      <span>Since {new Date(client.startDate).toLocaleDateString('en-US',{month:'short',year:'numeric'})}</span>
                    </div>
                    <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: C.accent, fontWeight: '600' }}>
                      {sessions[client.id]?.length || 0} session{sessions[client.id]?.length !== 1 ? 's' : ''} →
                    </div>
                  </div>
                ))}
              </div>
              );
            })()}
          </div>
        )}

        {/* ══════════════ SESSION VIEW ══════════════ */}
        {view === 'session' && currentClient && (
          <div className="fade">

            {/* Date bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <span style={{ color: C.muted, fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>Date</span>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                style={{ ...inputCss, width: 'auto', padding: '0.5rem 0.75rem', fontSize: '0.9rem' }} />
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: `1px solid ${C.border}`, paddingBottom: '0.5rem' }}>
              {['today', 'history', 'summary'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setSessionTab(tab)}
                  style={{
                    background: sessionTab === tab ? C.accent : 'transparent',
                    color: sessionTab === tab ? '#fff' : C.muted,
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: sessionTab === tab ? '700' : '500',
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    transition: 'all 0.2s',
                    marginLeft: tab === 'summary' ? 'auto' : '0'
                  }}>
                  {tab === 'today' ? 'Today' : tab === 'history' ? 'History' : 'Summary'}
                </button>
              ))}
            </div>

            {/* TODAY TAB */}
            {sessionTab === 'today' && (
              <>
            {/* Add exercise row */}
            <div style={{ ...cardCss, border: `1.5px dashed ${C.border}` }}>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input value={exerciseName}
                    onChange={e => { setExerciseName(e.target.value); search(e.target.value); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (showDropdown && exerciseOptions.length > 0 && dropdownIndex >= 0) {
                          // Select highlighted option
                          const selected = exerciseOptions[dropdownIndex];
                          setExerciseName('');
                          setShowDropdown(false);
                          setDropdownIndex(-1);
                          setExercises(prev => [...prev, {
                            id: Date.now().toString(), name: selected,
                            sets: '', reps: '', weight: '', duration: '', comment: '', saved: false
                          }]);
                        } else {
                          addExRow();
                        }
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (showDropdown && exerciseOptions.length > 0) {
                          setDropdownIndex(prev => (prev + 1) % exerciseOptions.length);
                        }
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (showDropdown && exerciseOptions.length > 0) {
                          setDropdownIndex(prev => prev <= 0 ? exerciseOptions.length - 1 : prev - 1);
                        }
                      } else if (e.key === 'Escape') {
                        setShowDropdown(false);
                        setDropdownIndex(-1);
                      }
                    }}
                    placeholder="Add exercise..."
                    style={{ ...inputCss, flex: 1, fontWeight: '600', fontSize: '1rem' }}
                    autoComplete="off"
                  />
                  <button onClick={addExRow} style={{ ...btnA, padding: '0.65rem 1.1rem', fontSize: '1.2rem' }}>+</button>
                </div>
                {showDropdown && exerciseOptions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.raised, border: `1.5px solid ${C.accent}`, borderRadius: '10px', marginTop: '4px', maxHeight: '220px', overflowY: 'auto', zIndex: 200, boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}>
                    {exerciseOptions.map((opt, i) => (
                      <div key={i} onClick={() => { 
                          setExerciseName(''); 
                          setShowDropdown(false);
                          setDropdownIndex(-1);
                          setExercises(prev => [...prev, {
                            id: Date.now().toString(), name: opt,
                            sets: '', reps: '', weight: '', duration: '', comment: '', saved: false
                          }]);
                        }}
                        style={{ 
                          padding: '0.8rem 1rem', 
                          cursor: 'pointer', 
                          borderBottom: i < exerciseOptions.length-1 ? `1px solid ${C.border}` : 'none', 
                          fontSize: '0.92rem', 
                          color: C.text, 
                          transition: 'background 0.1s',
                          background: i === dropdownIndex ? C.accent+'33' : 'transparent'
                        }}
                        onMouseEnter={e => { setDropdownIndex(i); }}
                        onMouseLeave={e => e.currentTarget.style.background = i === dropdownIndex ? C.accent+'33' : 'transparent'}>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Exercise rows */}
            {exercises.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {exercises.sort((a, b) => {
                  // Unsaved exercises at top, saved at bottom
                  if (a.saved === b.saved) return 0;
                  return a.saved ? 1 : -1;
                }).map((ex) => {
                  const last = getLastData(ex.name);
                  const isFocused = focusedExercise === ex.id;
                  return (
                    <div key={ex.id} style={{ position: 'relative', paddingRight: '5.5rem' }}>
                      {/* Floating action buttons */}
                      <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 10, width: '5rem' }}>
                        <button onClick={() => saveEx(ex)} style={{ 
                          ...btnA, 
                          padding: '0.65rem 0.5rem', 
                          fontSize: '0.75rem',
                          background: ex.saved ? C.border : C.accent,
                          color: ex.saved ? C.subtle : '#fff',
                          fontWeight: '700',
                          cursor: ex.saved ? 'default' : 'pointer',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          width: '100%'
                        }}>
                          {ex.saved ? 'Saved' : 'Save'}
                        </button>
                        <button onClick={() => setExercises(p => p.filter(e => e.id !== ex.id))} style={{ 
                          ...btnDel, 
                          padding: '0.65rem 0.5rem', 
                          fontSize: '0.75rem', 
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          width: '100%'
                        }}>Del</button>
                      </div>
                    <div 
                      style={{ background: ex.saved ? C.surface : C.raised, border: `1.5px solid ${ex.saved ? C.border : C.accent+'55'}`, borderRadius: '12px', overflow: 'hidden', transition: 'all 0.2s' }}>
                      {/* Last session hint */}
                      {last && (
                        <div style={{ padding: '0.4rem 0.9rem', background: C.accentDim, borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: last.hasComment ? '0.5rem' : 0 }}>
                            <span style={{ fontSize: '0.7rem', color: C.accent, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', flexShrink: 0 }}>Previous Session:</span>
                            <span style={{ fontSize: '0.78rem', color: C.text, fontFamily: 'DM Mono, monospace', fontWeight: '500' }}>{last.label}</span>
                            <span style={{ fontSize: '0.68rem', color: C.muted, marginLeft: 'auto', flexShrink: 0 }}>{last.date}</span>
                          </div>
                          {last.hasComment && (
                            <div 
                              onClick={() => setFocusedExercise(focusedExercise === ex.id ? null : ex.id)}
                              style={{ 
                                padding: isFocused ? '0.5rem 0.75rem' : '0.25rem 0.5rem', 
                                background: isFocused ? C.raised : 'transparent',
                                borderRadius: '6px',
                                borderLeft: isFocused ? `3px solid #FFA726` : 'none',
                                display: 'flex',
                                gap: isFocused ? '0.5rem' : '0.3rem',
                                alignItems: 'center',
                                transition: 'all 0.15s',
                                marginTop: isFocused ? '0.4rem' : '0.2rem',
                                cursor: 'pointer'
                              }}>
                              <span style={{ fontSize: isFocused ? '0.75rem' : '0.7rem', flexShrink: 0 }}>💬</span>
                              {isFocused ? (
                                <span style={{ fontSize: '0.8rem', color: C.subtle, fontStyle: 'italic', lineHeight: '1.4' }}>
                                  {last.comment}
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.65rem', color: C.muted, fontWeight: '500', opacity: 0.7 }}>
                                  note
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Input row */}
                      <div style={{ padding: '0.75rem 0.9rem' }}>
                        <div className="ex-row" style={{ gap: '0.5rem' }}>
                          <div className="ex-name" style={{ fontWeight: '700', fontSize: '0.95rem', flex: '0 0 auto', color: ex.saved ? C.subtle : C.text, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {ex.name}
                            {ex.saved && <span style={{ color: C.green, fontSize: '0.75rem' }}>✓</span>}
                          </div>
                          <div className="ex-inputs" style={{ flex: 1, display: 'flex', gap: '0.4rem', minWidth: 0 }}>
                          <input className="ex-num" type="number" value={ex.sets} onChange={e => updateEx(ex.id,'sets',e.target.value)}
                            placeholder="Sets" min="1"
                            onFocus={() => setFocusedExercise(ex.id)}
                            onBlur={() => {}}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveEx(ex); }
                              else if (e.key === 'ArrowRight' || e.key === 'Tab') {
                                if (!e.shiftKey) { e.preventDefault(); e.target.nextElementSibling?.focus(); }
                              }
                              else if (e.key === 'ArrowLeft') { e.preventDefault(); e.target.previousElementSibling?.focus(); }
                              else if (e.key === 'ArrowDown') { 
                                e.preventDefault();
                                const parent = e.target.closest('.ex-row');
                                const nextRow = parent?.parentElement?.nextElementSibling;
                                const sameInput = nextRow?.querySelector('.ex-num');
                                sameInput?.focus();
                              }
                              else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                const parent = e.target.closest('.ex-row');
                                const prevRow = parent?.parentElement?.previousElementSibling;
                                const sameInput = prevRow?.querySelector('.ex-num');
                                sameInput?.focus();
                              }
                            }}
                            style={{ ...inputCss, flex: '1 1 55px', padding: '0.55rem', textAlign: 'center', minWidth: 0 }} />
                          <input className="ex-num" type="number" value={ex.reps} onChange={e => updateEx(ex.id,'reps',e.target.value)}
                            placeholder="Reps" min="1"
                            onFocus={() => setFocusedExercise(ex.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveEx(ex); }
                              else if (e.key === 'ArrowRight' || e.key === 'Tab') {
                                if (!e.shiftKey) { e.preventDefault(); e.target.nextElementSibling?.focus(); }
                              }
                              else if (e.key === 'ArrowLeft') { e.preventDefault(); e.target.previousElementSibling?.focus(); }
                              else if (e.key === 'ArrowDown') { 
                                e.preventDefault();
                                const parent = e.target.closest('.ex-row');
                                const nextRow = parent?.parentElement?.nextElementSibling;
                                const inputs = nextRow?.querySelectorAll('.ex-num');
                                inputs?.[1]?.focus();
                              }
                              else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                const parent = e.target.closest('.ex-row');
                                const prevRow = parent?.parentElement?.previousElementSibling;
                                const inputs = prevRow?.querySelectorAll('.ex-num');
                                inputs?.[1]?.focus();
                              }
                            }}
                            style={{ ...inputCss, flex: '1 1 65px', padding: '0.55rem', textAlign: 'center', minWidth: 0 }} />
                          <input className="ex-num" type="number" value={ex.weight} onChange={e => updateEx(ex.id,'weight',e.target.value)}
                            placeholder="kg" min="0" step="0.5"
                            onFocus={() => setFocusedExercise(ex.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveEx(ex); }
                              else if (e.key === 'ArrowRight' || e.key === 'Tab') {
                                if (!e.shiftKey) { e.preventDefault(); e.target.nextElementSibling?.focus(); }
                              }
                              else if (e.key === 'ArrowLeft') { e.preventDefault(); e.target.previousElementSibling?.focus(); }
                              else if (e.key === 'ArrowDown') { 
                                e.preventDefault();
                                const parent = e.target.closest('.ex-row');
                                const nextRow = parent?.parentElement?.nextElementSibling;
                                const inputs = nextRow?.querySelectorAll('.ex-num');
                                inputs?.[2]?.focus();
                              }
                              else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                const parent = e.target.closest('.ex-row');
                                const prevRow = parent?.parentElement?.previousElementSibling;
                                const inputs = prevRow?.querySelectorAll('.ex-num');
                                inputs?.[2]?.focus();
                              }
                            }}
                            style={{ ...inputCss, flex: '1 1 65px', padding: '0.55rem', textAlign: 'center', minWidth: 0 }} />
                          <input className="ex-num" type="number" value={ex.duration} onChange={e => updateEx(ex.id,'duration',e.target.value)}
                            placeholder="sec" min="0"
                            onFocus={() => setFocusedExercise(ex.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveEx(ex); }
                              else if (e.key === 'ArrowRight' || e.key === 'Tab') {
                                if (!e.shiftKey) { e.preventDefault(); e.target.nextElementSibling?.nextElementSibling?.focus(); }
                              }
                              else if (e.key === 'ArrowLeft') { e.preventDefault(); e.target.previousElementSibling?.focus(); }
                              else if (e.key === 'ArrowDown') { 
                                e.preventDefault();
                                const parent = e.target.closest('.ex-row');
                                const nextRow = parent?.parentElement?.nextElementSibling;
                                const inputs = nextRow?.querySelectorAll('.ex-num');
                                inputs?.[3]?.focus();
                              }
                              else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                const parent = e.target.closest('.ex-row');
                                const prevRow = parent?.parentElement?.previousElementSibling;
                                const inputs = prevRow?.querySelectorAll('.ex-num');
                                inputs?.[3]?.focus();
                              }
                            }}
                            style={{ ...inputCss, flex: '1 1 55px', padding: '0.55rem', textAlign: 'center', minWidth: 0 }} />
                          <button
                            type="button"
                            onClick={() => timers[ex.id] ? stopTimer(ex.id) : startTimer(ex.id)}
                            style={{
                              background: timers[ex.id] ? '#EF4444' : C.green,
                              color: timers[ex.id] ? '#fff' : '#111',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.55rem 0.65rem',
                              cursor: 'pointer',
                              fontWeight: '700',
                              fontSize: '0.75rem',
                              fontFamily: 'DM Mono, monospace',
                              minWidth: '52px',
                              flexShrink: 0,
                              transition: 'all 0.15s'
                            }}>
                            {timers[ex.id] ? `${timers[ex.id].elapsed || 0}s` : '⏱'}
                          </button>
                          <input className="ex-comment" type="text" value={ex.comment} onChange={e => updateEx(ex.id,'comment',e.target.value)}
                            placeholder="Note..."
                            onFocus={() => setFocusedExercise(ex.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveEx(ex); }
                              else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
                                e.preventDefault(); e.target.previousElementSibling?.focus();
                              }
                              else if (e.key === 'ArrowDown') { 
                                e.preventDefault();
                                const parent = e.target.closest('.ex-row');
                                const nextRow = parent?.parentElement?.nextElementSibling;
                                const comment = nextRow?.querySelector('.ex-comment');
                                comment?.focus();
                              }
                              else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                const parent = e.target.closest('.ex-row');
                                const prevRow = parent?.parentElement?.previousElementSibling;
                                const comment = prevRow?.querySelector('.ex-comment');
                                comment?.focus();
                              }
                            }}
                            style={{ ...inputCss, flex: '2 1 90px', padding: '0.55rem', minWidth: 0 }} />
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>
                  );
                })}
              </div>
            )}
            </>
            )}

            {/* HISTORY TAB */}
            {sessionTab === 'history' && (
            <>{/* ── Session History ── */}
            {(sessions[currentClient.id]?.length > 0) && (
              <div style={cardCss}>
                <h3 className="bebas" style={{ fontSize: '1.4rem', color: C.accent, margin: '0 0 0.85rem 0', letterSpacing: '1px' }}>SESSION HISTORY</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {sessions[currentClient.id].map(session => {
                    const expanded = expandedSessions.has(session.id);
                    const isToday = session.date === sessionDate;
                    return (
                      <div key={session.id} id={`session-${session.id}`} style={{ border: `1.5px solid ${isToday ? C.accent+'66' : C.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                        <div onClick={() => toggleExpand(session.id)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0.9rem', cursor: 'pointer', background: expanded ? C.raised : 'transparent', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, minWidth: 0 }}>
                            {isToday && <span style={{ fontSize: '0.65rem', background: C.accent, color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '700', flexShrink: 0 }}>TODAY</span>}
                            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: C.text }}>
                              {new Date(session.date).toLocaleDateString('en-US',{ weekday:'short', month:'short', day:'numeric', year:'numeric' })}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: C.muted }}>{session.exercises.length} ex</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                            <button onClick={e => { e.stopPropagation(); deleteSession(session.clientId, session.id); }} style={btnDel}>del</button>
                            <span style={{ color: C.muted, fontSize: '0.75rem', userSelect: 'none' }}>{expanded ? '▼' : '▶'}</span>
                          </div>
                        </div>
                        {expanded && (
                          <div style={{ padding: '0 0.9rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {session.exercises.map(ex => {
                              const parts = [];
                              if (ex.sets)     parts.push(`${ex.sets} sets`);
                              if (ex.reps)     parts.push(`${ex.reps} reps`);
                              if (ex.weight)   parts.push(`${ex.weight} kg`);
                              if (ex.duration) parts.push(`${ex.duration}s`);
                              return (
                                <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.45rem 0', borderBottom: `1px solid ${C.border}` }}>
                                  <span style={{ fontWeight: '600', fontSize: '0.88rem', color: C.text }}>{ex.name}</span>
                                  <span className="mono" style={{ fontSize: '0.8rem', color: C.subtle }}>{parts.join(' · ') || '—'}</span>
                                  {ex.comment && <span style={{ fontSize: '0.75rem', color: C.muted, fontStyle: 'italic', marginLeft: '0.5rem' }}>{ex.comment}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </>
            )}

            {/* SUMMARY TAB */}
            {sessionTab === 'summary' && (
              <div style={cardCss}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 className="bebas" style={{ fontSize: '1.6rem', color: C.accent, margin: 0, letterSpacing: '1px' }}>EXERCISE SUMMARY</h3>
                  <button
                    onClick={() => {
                      const summary = getExerciseSummary();
                      if (summary.length === 0) { toast_('No data to export', false); return; }
                      
                      // Create CSV content
                      let csv = 'Exercise,Sessions,Last Sets,Last Reps,Last Weight (kg),Last Duration (s),Best Sets,Best Reps,Best Weight (kg),Best Duration (s)\n';
                      summary.forEach(ex => {
                        csv += `"${ex.name}",${ex.count},${ex.latest.sets||''},${ex.latest.reps||''},${ex.latest.weight||''},${ex.latest.duration||''},${ex.best.sets||''},${ex.best.reps||''},${ex.best.weight||''},${ex.best.duration||''}\n`;
                      });
                      
                      // Download
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.style.display = 'none';
                      a.href = url;
                      a.download = `${currentClient.name.replace(/[^a-z0-9]/gi, '_')}_summary_${new Date().toISOString().split('T')[0]}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      toast_('Downloaded CSV!');
                    }}
                    style={{ ...btnA, padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
                    📊 Export CSV
                  </button>
                </div>
                {(() => {
                  const summary = getExerciseSummary();
                  if (summary.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '3rem', color: C.muted }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                        <p>No exercises tracked yet</p>
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {summary.map(ex => {
                        const bestParts = [];
                        if (ex.best.sets) bestParts.push(`${ex.best.sets}×`);
                        if (ex.best.reps) bestParts.push(`${ex.best.reps}r`);
                        if (ex.best.weight) bestParts.push(`${ex.best.weight}kg`);
                        if (ex.best.duration) bestParts.push(`${ex.best.duration}s`);
                        
                        const latestParts = [];
                        if (ex.latest.sets) latestParts.push(`${ex.latest.sets}×`);
                        if (ex.latest.reps) latestParts.push(`${ex.latest.reps}r`);
                        if (ex.latest.weight) latestParts.push(`${ex.latest.weight}kg`);
                        if (ex.latest.duration) latestParts.push(`${ex.latest.duration}s`);
                        
                        return (
                          <div key={ex.name} style={{ 
                            background: C.raised, 
                            border: `1px solid ${C.border}`, 
                            borderRadius: '6px', 
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            justifyContent: 'space-between'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: C.text }}>{ex.name}</span>
                              <span style={{ fontSize: '0.65rem', color: C.muted, fontWeight: '600' }}>
                                {ex.count}×
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', flexShrink: 0 }}>
                              <div className="mono" style={{ color: C.subtle }}>
                                <span style={{ color: C.accent, fontSize: '0.65rem', fontWeight: '700', marginRight: '0.35rem' }}>Last</span>
                                {latestParts.join(' ') || '—'}
                              </div>
                              <div className="mono" style={{ color: C.subtle }}>
                                <span style={{ color: C.green, fontSize: '0.65rem', fontWeight: '700', marginRight: '0.35rem' }}>Best</span>
                                {bestParts.join(' ') || '—'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast.show && (
        <div style={{ position: 'fixed', bottom: '1.25rem', left: '50%', transform: 'translateX(-50%)', background: toast.ok ? C.green : '#EF4444', color: toast.ok ? '#111' : '#fff', padding: '0.7rem 1.4rem', borderRadius: '8px', zIndex: 300, fontWeight: '700', fontSize: '0.88rem', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }} className="fade">
          {toast.msg}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<TrainerApp />);
