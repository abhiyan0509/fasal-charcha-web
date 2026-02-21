'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalFarmers: 0,
        statesCovered: 0,
        surveysCompleted: 0,
        surveyRate: '0%',
    });
    const [recentFarmers, setRecentFarmers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    async function fetchDashboardData() {
        try {
            // Total farmers
            const { count: farmerCount } = await supabase
                .from('farmers')
                .select('*', { count: 'exact', head: true });

            // Distinct states
            const { data: statesData } = await supabase
                .from('farmers')
                .select('state');
            const uniqueStates = new Set((statesData || []).map(f => f.state).filter(Boolean));

            // Survey stats
            const { count: totalSessions } = await supabase
                .from('survey_sessions')
                .select('*', { count: 'exact', head: true });

            const { count: completedSessions } = await supabase
                .from('survey_sessions')
                .select('*', { count: 'exact', head: true })
                .not('completed_at', 'is', null);

            // Recent farmers
            const { data: recent } = await supabase
                .from('farmers')
                .select('full_name, phone_number, state, district')
                .order('created_at', { ascending: false })
                .limit(5);

            const total = farmerCount || 0;
            const completed = completedSessions || 0;

            setStats({
                totalFarmers: total,
                statesCovered: uniqueStates.size,
                surveysCompleted: completed,
                surveyRate: total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%',
            });

            setRecentFarmers(recent || []);
        } catch (err) {
            console.error('Dashboard error:', err);
        } finally {
            setLoading(false);
        }
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
                <h1>📊 Dashboard</h1>
                <p>Overview of your Fasal Charcha platform</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card green">
                    <div className="stat-icon">🌾</div>
                    <div className="stat-label">Total Farmers</div>
                    <div className="stat-value">{stats.totalFarmers.toLocaleString()}</div>
                </div>

                <div className="stat-card blue">
                    <div className="stat-icon">🗺️</div>
                    <div className="stat-label">States Covered</div>
                    <div className="stat-value">{stats.statesCovered}</div>
                </div>

                <div className="stat-card purple">
                    <div className="stat-icon">📋</div>
                    <div className="stat-label">Surveys Done</div>
                    <div className="stat-value">{stats.surveysCompleted}</div>
                </div>

                <div className="stat-card orange">
                    <div className="stat-icon">📈</div>
                    <div className="stat-label">Survey Rate</div>
                    <div className="stat-value">{stats.surveyRate}</div>
                </div>
            </div>

            {/* Recent Farmers */}
            <div className="glass-card animate-in" style={{ animationDelay: '0.4s' }}>
                <h3 style={{ marginBottom: 16 }}>Recent Farmers</h3>
                {recentFarmers.length > 0 ? (
                    <div className="data-table-wrapper" style={{ border: 'none' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>State</th>
                                    <th>District</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentFarmers.map((f, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 500 }}>{f.full_name || '—'}</td>
                                        <td><code style={{ color: 'var(--accent-green)', background: 'var(--bg-glass)', padding: '2px 6px', borderRadius: 4, fontSize: '0.82rem' }}>{f.phone_number}</code></td>
                                        <td>{f.state || '—'}</td>
                                        <td>{f.district || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="alert alert-info">No farmers yet. Go to Farmers page to upload data.</div>
                )}
            </div>
        </>
    );
}
