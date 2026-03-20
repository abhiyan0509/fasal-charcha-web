'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const SURVEY_QUESTIONS = [
    'What crop are you currently growing?',
    'What is the total area of your farmland (in acres)?',
    'Have you faced any pest or disease attacks recently?',
    'What type of seeds do you use?',
    'Are you interested in organic farming training?',
    'What is your main source of irrigation?',
];

// Short labels for pivot columns
const Q_SHORT = ['Crop', 'Area (acres)', 'Pest Issues', 'Seed Type', 'Organic Interest', 'Irrigation'];

// ─── Intelligent Answer Normalization ───────────────────────────────────
// Known categories per question, with keywords that map to each category
const ANSWER_CATEGORIES = {
    // Q0: Crop
    0: {
        'Wheat': ['wheat', 'gehun', 'gehu'],
        'Rice': ['rice', 'chawal', 'dhan', 'paddy'],
        'Cotton': ['cotton', 'kapas', 'kapaa'],
        'Soybean': ['soybean', 'soya', 'soyabean'],
        'Maize': ['maize', 'makka', 'corn'],
        'Sugarcane': ['sugarcane', 'ganna', 'sugar'],
        'Pulses': ['pulses', 'dal', 'lentil', 'gram', 'chana', 'moong', 'urad', 'toor', 'arhar'],
        'Vegetables': ['vegetable', 'sabji', 'sabzi', 'tomato', 'onion', 'potato'],
        'Mustard': ['mustard', 'sarson', 'rai'],
        'Millet': ['millet', 'bajra', 'jowar', 'ragi'],
    },
    // Q1: Area — extract numeric value and bucket
    1: '_numeric',
    // Q2: Pest/Disease
    2: {
        'Yes': ['yes', 'haan', 'ha', 'haa', 'ji', 'faced', 'deal', 'insect', 'pest', 'disease', 'attack', 'encountered', 'recently'],
        'No': ['no', 'nahi', 'naa', 'nahin', 'not'],
    },
    // Q3: Seed type
    3: {
        'Hybrid': ['hybrid'],
        'Traditional': ['traditional', 'indigenous', 'desi', 'local'],
        'Both': ['both', 'dono'],
    },
    // Q4: Organic interest
    4: {
        'Yes': ['yes', 'haan', 'ha', 'haa', 'ji', 'interested', 'interest', 'organic'],
        'No': ['no', 'nahi', 'naa', 'nahin', 'not'],
    },
    // Q5: Irrigation
    5: {
        'Borewell': ['borewell', 'borwell', 'borwill', 'bore', 'tubewell', 'tube'],
        'Canal': ['canal', 'nahar', 'nehar', 'naala', 'canal water'],
        'Rain-fed': ['rain', 'rainfed', 'barish', 'varsha', 'baarish', 'seasonal', 'based on the year', 'based on year'],
        'River': ['river', 'nadi'],
        'Drip': ['drip', 'sprinkler', 'micro'],
        'Well': ['well', 'kuan', 'kuwa'],
    },
};

function normalizeAnswer(rawAnswer, questionIndex) {
    if (!rawAnswer || !rawAnswer.trim()) return '';

    // Step 1: Basic cleanup — lowercase, strip punctuation, trim
    let cleaned = rawAnswer
        .trim()
        .toLowerCase()
        .replace(/[.!?,;:'"()[\]{}]/g, '')  // remove punctuation
        .replace(/\s+/g, ' ')               // collapse whitespace
        .trim();

    if (!cleaned) return '';

    // --- Global Invalid Checks ---
    // Ignore common greetings that mistakenly get recorded as answers
    if (['hi', 'hello', 'hey', 'namaste', 'kem cho'].includes(cleaned)) {
        return 'Invalid/Greeting';
    }
    
    // Ignore translation hallucinations from Sarvam (extremely long or repetitive text)
    if (cleaned.length > 150 || cleaned.includes('translation of the given') || cleaned.includes('correct translation')) {
        return 'Invalid/Translation Error';
    }

    // Bare single-digit numbers on non-numeric questions are likely mistakes
    if (questionIndex !== 1 && /^\d{1}$/.test(cleaned)) {
        return 'Invalid/Unclear';
    }

    // Known untranslated/garbage words
    if (['shakou', 'tari kotha'].includes(cleaned)) {
        return 'Invalid/Untranslated';
    }

    const categories = ANSWER_CATEGORIES[questionIndex];

    // Step 2: Numeric handling (area question)
    if (categories === '_numeric') {
        const numMatch = cleaned.match(/[\d]+\.?[\d]*/);
        if (numMatch) {
            const num = parseFloat(numMatch[0]);
            if (num <= 1) return '≤ 1 acre';
            if (num <= 2) return '1–2 acres';
            if (num <= 5) return '2–5 acres';
            if (num <= 10) return '5–10 acres';
            return '10+ acres';
        }
        // If no number found, try word numbers
        const wordNums = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
        for (const [word, num] of Object.entries(wordNums)) {
            if (cleaned.includes(word)) {
                if (num <= 1) return '≤ 1 acre';
                if (num <= 2) return '1–2 acres';
                if (num <= 5) return '2–5 acres';
                if (num <= 10) return '5–10 acres';
                return '10+ acres';
            }
        }
        // Return cleaned text as-is if no number found
        return cleaned;
    }

    // Step 3: Category matching using keywords
    if (categories && typeof categories === 'object') {
        // Check each category's keywords
        for (const [category, keywords] of Object.entries(categories)) {
            for (const kw of keywords) {
                if (cleaned.includes(kw)) {
                    return category;
                }
            }
        }
    }

    // Step 4: Fallback — capitalize first letter for display
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default function ResponsesPage() {
    const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, invalidCount: 0 });
    const [sessions, setSessions] = useState([]);
    const [pivotData, setPivotData] = useState([]);
    const [rawData, setRawData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('summary'); // 'summary' | 'pivot' | 'raw'
    const [answerStats, setAnswerStats] = useState({});
    const [showInvalid, setShowInvalid] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            // Survey sessions (with language info)
            const { data: sessionData, error: sessionErr } = await supabase
                .from('survey_sessions')
                .select('*')
                .order('started_at', { ascending: false });
            
            if (sessionErr) console.error("Session fetch error:", sessionErr);

            const allSessions = sessionData || [];
            setSessions(allSessions);

            const completedCount = allSessions.filter(s => s.completed_at).length;

            // Get all responses
            const { data: responses } = await supabase
                .from('survey_responses')
                .select('*')
                .order('answered_at', { ascending: true })
                .limit(2000);

            const allResponses = responses || [];
            setRawData(allResponses);

            // Count invalid translations (either from DB flag or normalizer heuristic)
            const invalidCount = allResponses.filter(r => {
                // Use DB flag if available
                if (r.translation_valid === false) return true;
                // Fallback heuristic for old records without the flag
                const norm = normalizeAnswer(r.answer, r.question_index);
                return norm.startsWith('Invalid/');
            }).length;

            setStats({
                total: allSessions.length,
                completed: completedCount,
                inProgress: allSessions.length - completedCount,
                invalidCount,
            });

            // Build pivot: group by phone_number
            const byPhone = {};
            allResponses.forEach(r => {
                if (!byPhone[r.phone_number]) byPhone[r.phone_number] = {};
                byPhone[r.phone_number][r.question_index] = r.answer;
            });

            const pivot = Object.entries(byPhone).map(([phone, answers]) => ({
                phone,
                answers,
                language: allSessions.find(s => s.phone_number === phone)?.language || '—',
            }));

            setPivotData(pivot);

            // Build answer frequency stats per question — WITH NORMALIZATION + FILTERING
            buildAnswerStats(allResponses);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }

    function buildAnswerStats(responses) {
        const qStats = {};
        SURVEY_QUESTIONS.forEach((_, qi) => {
            const answersForQ = (responses || rawData).filter(r => r.question_index === qi);
            const freq = {};
            answersForQ.forEach(r => {
                // Skip invalid translations unless toggled on
                const isDBInvalid = r.translation_valid === false;
                const normalized = normalizeAnswer(r.answer, qi);
                const isHeuristicInvalid = normalized.startsWith('Invalid/');
                
                if (!showInvalid && (isDBInvalid || isHeuristicInvalid)) return;
                if (isDBInvalid || isHeuristicInvalid) {
                    // Group all invalids together
                    const key = isDBInvalid ? 'Invalid/Translation Failed' : normalized;
                    freq[key] = (freq[key] || 0) + 1;
                } else {
                    if (normalized) freq[normalized] = (freq[normalized] || 0) + 1;
                }
            });
            qStats[qi] = Object.entries(freq)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
        });
        setAnswerStats(qStats);
    }

    // Rebuild stats when showInvalid toggles
    useEffect(() => {
        if (rawData.length > 0) buildAnswerStats(rawData);
    }, [showInvalid]);

    // Language distribution
    const langDist = {};
    sessions.forEach(s => {
        const lang = s.language || 'english';
        langDist[lang] = (langDist[lang] || 0) + 1;
    });
    const langEntries = Object.entries(langDist).sort((a, b) => b[1] - a[1]);

    function downloadCSV() {
        const headers = ['Phone', 'Language', ...Q_SHORT];
        const rows = pivotData.map(r => [
            r.phone,
            r.language,
            ...SURVEY_QUESTIONS.map((_, i) => r.answers[i] || ''),
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'survey_responses.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div className="loading" style={{ width: 40, height: 40 }}></div>
            </div>
        );
    }

    const maxLangCount = Math.max(...Object.values(langDist), 1);

    return (
        <>
            <div className="page-header">
                <h1>Survey Responses</h1>
                <p>Visualize farmer survey answers collected via WhatsApp</p>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon-wrap">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>
                        </div>
                        <div className="stat-label">Total Surveys</div>
                    </div>
                    <div className="stat-value">{stats.total}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon-wrap">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                        </div>
                        <div className="stat-label">Completed</div>
                    </div>
                    <div className="stat-value">{stats.completed}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon-wrap">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        </div>
                        <div className="stat-label">In Progress</div>
                    </div>
                    <div className="stat-value">{stats.inProgress}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon-wrap">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" /></svg>
                        </div>
                        <div className="stat-label">Total Answers</div>
                    </div>
                    <div className="stat-value">{rawData.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon-wrap" style={{ background: stats.invalidCount > 0 ? 'rgba(239,68,68,0.15)' : undefined }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stats.invalidCount > 0 ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
                        </div>
                        <div className="stat-label">Translation Issues</div>
                    </div>
                    <div className="stat-value" style={{ color: stats.invalidCount > 0 ? '#ef4444' : undefined }}>{stats.invalidCount}</div>
                </div>
            </div>

            {/* Language Distribution */}
            {langEntries.length > 0 && (
                <div className="glass-card animate-in" style={{ marginBottom: 24 }}>
                    <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        🌐 Language Distribution
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {langEntries.map(([lang, count]) => (
                            <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ minWidth: 90, fontWeight: 500, textTransform: 'capitalize', fontSize: '0.9rem' }}>{lang}</span>
                                <div style={{ flex: 1, background: 'var(--bg-primary)', borderRadius: 6, height: 28, overflow: 'hidden', position: 'relative' }}>
                                    <div style={{
                                        width: `${(count / maxLangCount) * 100}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                                        borderRadius: 6,
                                        transition: 'width 0.6s ease',
                                        minWidth: 30,
                                        display: 'flex',
                                        alignItems: 'center',
                                        paddingLeft: 10,
                                    }}>
                                        <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>{count}</span>
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', minWidth: 40 }}>
                                    {stats.total > 0 ? Math.round((count / stats.total) * 100) : 0}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* View Toggle + Actions */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                {['summary', 'pivot', 'raw'].map(mode => (
                    <button
                        key={mode}
                        className={`btn ${viewMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setViewMode(mode)}
                        style={{ textTransform: 'capitalize', fontSize: '0.85rem', padding: '8px 16px' }}
                    >
                        {mode === 'summary' ? '📊 Answer Summary' : mode === 'pivot' ? '📋 Pivot Table' : '📄 Raw Data'}
                    </button>
                ))}

                <button
                    className={`btn ${showInvalid ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowInvalid(!showInvalid)}
                    style={{ fontSize: '0.85rem', padding: '8px 16px', borderColor: showInvalid ? '#ef4444' : undefined, color: showInvalid ? '#ef4444' : undefined }}
                >
                    {showInvalid ? '⚠️ Hiding Invalid' : '⚠️ Show Invalid'} ({stats.invalidCount})
                </button>

                <div style={{ flex: 1 }}></div>

                {pivotData.length > 0 && (
                    <button className="btn btn-secondary" onClick={downloadCSV} style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
                        ⬇ Download CSV
                    </button>
                )}
                <button className="btn btn-secondary" onClick={fetchData} style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
                    🔄 Refresh
                </button>
            </div>

            {/* Content based on view mode */}
            {pivotData.length > 0 ? (
                <>
                    {/* Answer Summary View */}
                    {viewMode === 'summary' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
                            {SURVEY_QUESTIONS.map((q, qi) => {
                                const entries = answerStats[qi] || [];
                                const totalForQ = entries.reduce((sum, [, c]) => sum + c, 0);
                                const maxCount = entries.length > 0 ? entries[0][1] : 1;
                                const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];
                                return (
                                    <div key={qi} className="glass-card animate-in" style={{ animationDelay: `${qi * 0.05}s` }}>
                                        <h4 style={{ marginBottom: 4, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                            <span className="badge badge-blue" style={{ marginRight: 8 }}>Q{qi + 1}</span>
                                            {Q_SHORT[qi]}
                                        </h4>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.3 }}>{q}</p>

                                        {entries.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {entries.map(([answer, count], ai) => (
                                                    <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ flex: 1, position: 'relative' }}>
                                                            <div style={{
                                                                background: 'var(--bg-primary)',
                                                                borderRadius: 5,
                                                                height: 30,
                                                                overflow: 'hidden',
                                                            }}>
                                                                <div style={{
                                                                    width: `${(count / maxCount) * 100}%`,
                                                                    height: '100%',
                                                                    background: colors[ai % colors.length] + '33',
                                                                    borderLeft: `3px solid ${colors[ai % colors.length]}`,
                                                                    borderRadius: 5,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    paddingLeft: 8,
                                                                    minWidth: 'fit-content',
                                                                }}>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                                                                        {answer}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 50, textAlign: 'right' }}>
                                                            {count} ({totalForQ > 0 ? Math.round((count / totalForQ) * 100) : 0}%)
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No answers yet</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pivot View */}
                    {viewMode === 'pivot' && (
                        <div className="data-table-wrapper animate-in">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Phone</th>
                                        <th>Language</th>
                                        {Q_SHORT.map((q, i) => (
                                            <th key={i} title={SURVEY_QUESTIONS[i]} style={{ maxWidth: 140 }}>{q}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pivotData.map((row, i) => (
                                        <tr key={i}>
                                            <td><code>{row.phone}</code></td>
                                            <td><span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>{row.language}</span></td>
                                            {SURVEY_QUESTIONS.map((_, qi) => (
                                                <td key={qi} style={{ fontWeight: 500 }}>
                                                    {row.answers[qi] || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Raw Data View */}
                    {viewMode === 'raw' && (
                        <div className="data-table-wrapper animate-in">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Phone</th>
                                        <th>Q#</th>
                                        <th>Question</th>
                                        <th>Answer</th>
                                        <th>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rawData.map((r, i) => (
                                        <tr key={i}>
                                            <td><code>{r.phone_number}</code></td>
                                            <td><span className="badge badge-blue">Q{r.question_index + 1}</span></td>
                                            <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: 200 }}>
                                                {Q_SHORT[r.question_index] || `Q${r.question_index + 1}`}
                                            </td>
                                            <td style={{ fontWeight: 500 }}>{r.answer}</td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                                {new Date(r.answered_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            ) : (
                <div className="glass-card">
                    <div className="alert alert-info" style={{ margin: 0 }}>
                        No survey responses yet. Send a campaign and have farmers reply HI to start the survey.
                    </div>
                </div>
            )}
        </>
    );
}
