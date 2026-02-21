'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function FarmersPage() {
    const [farmers, setFarmers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState(null);

    useEffect(() => {
        fetchFarmers();
    }, []);

    async function fetchFarmers() {
        setLoading(true);
        try {
            let query = supabase
                .from('farmers')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);

            const { data, error } = await query;
            if (error) throw error;
            setFarmers(data || []);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }

    const filteredFarmers = farmers.filter(f => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
            (f.full_name || '').toLowerCase().includes(term) ||
            (f.phone_number || '').includes(term) ||
            (f.state || '').toLowerCase().includes(term) ||
            (f.district || '').toLowerCase().includes(term)
        );
    });

    async function handleFileUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadMsg(null);

        try {
            // Read CSV file
            const text = await file.text();
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) {
                setUploadMsg({ type: 'error', text: 'File is empty or has no data rows.' });
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
            const records = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
                const row = {};
                headers.forEach((h, idx) => {
                    row[h] = values[idx] || '';
                });

                // Map to our schema
                const record = {
                    full_name: row.full_name || row.name || row.farmer_name || '',
                    phone_number: (row.phone_number || row.phone || row.mobile || '').replace(/[^0-9]/g, ''),
                    state: row.state || '',
                    district: row.district || '',
                    preferred_language: row.preferred_language || row.language || 'Hindi',
                };

                if (record.phone_number && record.phone_number.length >= 10) {
                    records.push(record);
                }
            }

            if (records.length === 0) {
                setUploadMsg({ type: 'error', text: 'No valid records found. Ensure columns: full_name, phone_number, state, district.' });
                return;
            }

            // Upsert to Supabase
            const { error } = await supabase
                .from('farmers')
                .upsert(records, { onConflict: 'phone_number' });

            if (error) throw error;

            setUploadMsg({ type: 'success', text: `Successfully uploaded ${records.length} farmers!` });
            fetchFarmers();
        } catch (err) {
            setUploadMsg({ type: 'error', text: `Upload failed: ${err.message}` });
        } finally {
            setUploading(false);
        }
    }

    return (
        <>
            <div className="page-header">
                <h1>🌾 Farmers</h1>
                <p>Manage your farmer database</p>
            </div>

            {/* Upload Section */}
            <div className="glass-card animate-in" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 12 }}>Upload Farmer Data</h3>
                <label className="upload-zone" htmlFor="csv-upload" style={{ display: 'block' }}>
                    <div className="upload-icon">📁</div>
                    <div className="upload-text">
                        {uploading ? 'Uploading...' : 'Click to upload CSV file'}
                    </div>
                    <div className="upload-hint">CSV with columns: full_name, phone_number, state, district</div>
                    <input
                        id="csv-upload"
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        disabled={uploading}
                    />
                </label>
                {uploadMsg && (
                    <div className={`alert ${uploadMsg.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 12 }}>
                        {uploadMsg.text}
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card green">
                    <div className="stat-label">Total Farmers</div>
                    <div className="stat-value">{farmers.length}</div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-label">Showing</div>
                    <div className="stat-value">{filteredFarmers.length}</div>
                </div>
            </div>

            {/* Search */}
            <div className="form-group" style={{ maxWidth: 400 }}>
                <input
                    className="form-input"
                    type="text"
                    placeholder="🔍 Search by name, phone, state, district..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <div className="loading" style={{ width: 32, height: 32 }}></div>
                </div>
            ) : (
                <div className="data-table-wrapper animate-in" style={{ animationDelay: '0.2s' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>State</th>
                                <th>District</th>
                                <th>Language</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFarmers.length > 0 ? (
                                filteredFarmers.map((f, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 500 }}>{f.full_name || '—'}</td>
                                        <td>
                                            <code style={{ color: 'var(--accent-green)', background: 'var(--bg-glass)', padding: '2px 6px', borderRadius: 4, fontSize: '0.82rem' }}>
                                                {f.phone_number}
                                            </code>
                                        </td>
                                        <td>{f.state || '—'}</td>
                                        <td>{f.district || '—'}</td>
                                        <td><span className="badge badge-blue">{f.preferred_language || '—'}</span></td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                        {searchTerm ? 'No farmers match your search' : 'No farmers yet. Upload a CSV above.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
