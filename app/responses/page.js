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
                <h1>📋 Survey Responses</h1>
                <p>View farmer survey answers collected via WhatsApp</p>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card green">
                    <div className="stat-icon">📊</div>
                    <div className="stat-label">Total Surveys</div>
                    <div className="stat-value">{stats.total}</div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-icon">✅</div>
                    <div className="stat-label">Completed</div>
                    <div className="stat-value">{stats.completed}</div>
                </div>
                <div className="stat-card orange">
                    <div className="stat-icon">⏳</div>
                    <div className="stat-label">In Progress</div>
                    <div className="stat-value">{stats.inProgress}</div>
                </div>
                <div className="stat-card purple">
                    <div className="stat-icon">💬</div>
                    <div className="stat-label">Total Answers</div>
                    <div className="stat-value">{rawData.length}</div>
                </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                {pivotData.length > 0 && (
                    <button className="btn btn-primary" onClick={downloadCSV}>
                        📥 Download CSV
                    </button>
                )}
                <button className="btn btn-secondary" onClick={() => setShowRaw(!showRaw)}>
                    {showRaw ? '📊 Pivot View' : '📄 Raw Data'}
                </button>
                <button className="btn btn-secondary" onClick={fetchData}>
                    🔄 Refresh
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
                                        <td><code style={{ color: 'var(--accent-green)', fontSize: '0.82rem' }}>{r.phone_number}</code></td>
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
                                        <td><code style={{ color: 'var(--accent-green)', fontSize: '0.82rem' }}>{row.phone}</code></td>
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
