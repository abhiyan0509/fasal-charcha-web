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
                <h1>Dashboard</h1>
                <p>Overview of your Fasal Charcha platform</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon-wrap">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        </div>
                        <div className="stat-label">Total Farmers</div>
                    </div>
                    <div className="stat-value">{stats.totalFarmers.toLocaleString()}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon-wrap">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" x2="9" y1="3" y2="18" /><line x1="15" x2="15" y1="6" y2="21" /></svg>
                        </div>
                        <div className="stat-label">States Covered</div>
                    </div>
                    <div className="stat-value">{stats.statesCovered}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon-wrap">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                        </div>
                        <div className="stat-label">Surveys Done</div>
                    </div>
                    <div className="stat-value">{stats.surveysCompleted}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon-wrap">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                        </div>
                        <div className="stat-label">Survey Rate</div>
                    </div>
                    <div className="stat-value">{stats.surveyRate}</div>
                </div>
            </div>

            {/* Recent Farmers */}
            <div className="glass-card animate-in">
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
                                        <td><code>{f.phone_number}</code></td>
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
