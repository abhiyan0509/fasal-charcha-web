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

export default function ResponsesPage() {
    const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0 });
    const [pivotData, setPivotData] = useState([]);
    const [rawData, setRawData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showRaw, setShowRaw] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            // Survey session stats
            const { count: totalSessions } = await supabase
                .from('survey_sessions')
                .select('*', { count: 'exact', head: true });

            const { count: completedSessions } = await supabase
                .from('survey_sessions')
                .select('*', { count: 'exact', head: true })
                .not('completed_at', 'is', null);

            setStats({
                total: totalSessions || 0,
                completed: completedSessions || 0,
                inProgress: (totalSessions || 0) - (completedSessions || 0),
            });

            // Get all responses
            const { data: responses } = await supabase
                .from('survey_responses')
                .select('*')
                .order('answered_at', { ascending: true })
                .limit(1000);

            setRawData(responses || []);

            // Build pivot: group by phone_number
            const byPhone = {};
            (responses || []).forEach(r => {
                if (!byPhone[r.phone_number]) byPhone[r.phone_number] = {};
                byPhone[r.phone_number][r.question_index] = r.answer;
            });

            const pivot = Object.entries(byPhone).map(([phone, answers]) => ({
                phone,
                answers,
            }));

            setPivotData(pivot);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }

    function downloadCSV() {
        const headers = ['Phone', ...SURVEY_QUESTIONS.map((_, i) => `Q${i + 1}`)];
        const rows = pivotData.map(r => [
            r.phone,
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

    return (
        <>
            <div className="page-header">
                <h1>Survey Responses</h1>
                <p>View farmer survey answers collected via WhatsApp</p>
            </div>

            {/* Stats */}
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
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                {pivotData.length > 0 && (
                    <button className="btn btn-primary" onClick={downloadCSV}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                        Download CSV
                    </button>
                )}
                <button className="btn btn-secondary" onClick={() => setShowRaw(!showRaw)}>
                    {showRaw ? (
                        <><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><line x1="3" x2="21" y1="9" y2="9" /><line x1="9" x2="9" y1="9" y2="21" /></svg> Pivot View</>
                    ) : (
                        <><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></svg> Raw Data</>
                    )}
                </button>
                <button className="btn btn-secondary" onClick={fetchData}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                    Refresh
                </button>
            </div>

            {/* Data */}
            {pivotData.length > 0 ? (
                showRaw ? (
                    /* Raw data view */
                    <div className="data-table-wrapper animate-in">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Phone</th>
                                    <th>Q#</th>
                                    <th>Answer</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rawData.map((r, i) => (
                                    <tr key={i}>
                                        <td><code>{r.phone_number}</code></td>
                                        <td><span className="badge badge-blue">Q{r.question_index + 1}</span></td>
                                        <td style={{ fontWeight: 500 }}>{r.answer}</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                            {new Date(r.answered_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* Pivot view */
                    <div className="data-table-wrapper animate-in">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Phone</th>
                                    {SURVEY_QUESTIONS.map((q, i) => (
                                        <th key={i} title={q} style={{ maxWidth: 140 }}>
                                            {q.split('?')[0].split('(')[0].replace(/[0-9️⃣]/g, '').trim().substring(0, 25)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {pivotData.map((row, i) => (
                                    <tr key={i}>
                                        <td><code>{row.phone}</code></td>
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
                )
            ) : (
                <div className="glass-card">
                    <div className="alert alert-info" style={{ margin: 0 }}>
                        No survey responses yet. Send a campaign and have farmers reply to start the survey.
                    </div>
                </div>
            )}
        </>
    );
}
