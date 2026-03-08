'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CampaignsPage() {
    const [allFarmers, setAllFarmers] = useState([]);
    const [testMode, setTestMode] = useState(true);
    const [messageType, setMessageType] = useState('template');
    const [templateName, setTemplateName] = useState('hello_world');
    const [templateLang, setTemplateLang] = useState('en');
    const [messageText, setMessageText] = useState(
        'Namaste {name}! Welcome to Fasal Charcha. Reply HI to start a crop survey!'
    );
    const [testPhone, setTestPhone] = useState('');
    const [testName, setTestName] = useState('');
    const [campaignName, setCampaignName] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0, done: false });

    // Filters
    const [filterState, setFilterState] = useState('ALL');
    const [filterDistrict, setFilterDistrict] = useState('ALL');
    const [filterLanguage, setFilterLanguage] = useState('ALL');
    const [showAudience, setShowAudience] = useState(false);

    // Derived values
    const [states, setStates] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [languages, setLanguages] = useState([]);

    useEffect(() => {
        fetchFarmers();
    }, []);

    async function fetchFarmers() {
        const { data } = await supabase
            .from('farmers')
            .select('full_name, phone_number, state, district, preferred_language')
            .limit(2000);

        const farmers = data || [];
        setAllFarmers(farmers);

        // Extract unique filter options
        const uniqueStates = [...new Set(farmers.map(f => f.state).filter(Boolean))].sort();
        const uniqueDistricts = [...new Set(farmers.map(f => f.district).filter(Boolean))].sort();
        const uniqueLangs = [...new Set(farmers.map(f => f.preferred_language).filter(Boolean))].sort();
        setStates(uniqueStates);
        setDistricts(uniqueDistricts);
        setLanguages(uniqueLangs);
    }

    // Apply filters to get target audience
    const filteredFarmers = allFarmers.filter(f => {
        if (filterState !== 'ALL' && f.state !== filterState) return false;
        if (filterDistrict !== 'ALL' && f.district !== filterDistrict) return false;
        if (filterLanguage !== 'ALL' && f.preferred_language !== filterLanguage) return false;
        return true;
    });

    // Update districts when state changes
    const availableDistricts = filterState === 'ALL'
        ? districts
        : [...new Set(allFarmers.filter(f => f.state === filterState).map(f => f.district).filter(Boolean))].sort();

    async function handleSend() {
        setSending(true);
        setResult(null);

        if (testMode) {
            // Test mode — single message
            const phone = testPhone.replace(/[^0-9]/g, '');
            if (!phone || phone.length < 10) {
                setResult({ success: false, error: 'Enter a valid phone number' });
                setSending(false);
                return;
            }

            try {
                const endpoint = messageType === 'template' ? '/api/send-template' : '/api/send-message';
                const body = messageType === 'template'
                    ? { to: phone, template_name: templateName, language: templateLang, parameters: testName ? [testName] : undefined }
                    : { to: phone, message: messageText.replace('{name}', testName || 'Farmer') };

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                const data = await res.json();
                setResult(data);
            } catch (err) {
                setResult({ success: false, error: err.message });
            }
        } else {
            // Live mode — send to filtered farmers
            const targets = filteredFarmers;

            if (targets.length === 0) {
                setResult({ success: false, error: 'No farmers match your filters' });
                setSending(false);
                return;
            }

            setProgress({ sent: 0, failed: 0, total: targets.length, done: false });

            let sent = 0, failed = 0;

            for (const farmer of targets) {
                const phone = (farmer.phone_number || '').replace(/[^0-9]/g, '');
                if (!phone || phone.length < 10) { failed++; continue; }

                const farmerName = farmer.full_name || 'Farmer';

                try {
                    const endpoint = messageType === 'template' ? '/api/send-template' : '/api/send-message';
                    const body = messageType === 'template'
                        ? { to: phone, template_name: templateName, language: templateLang, parameters: [farmerName] }
                        : { to: phone, message: messageText.replace('{name}', farmerName) };

                    const res = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });

                    const data = await res.json();
                    if (data.success) sent++; else failed++;
                } catch {
                    failed++;
                }

                setProgress({ sent, failed, total: targets.length, done: false });

                // Rate limit — 1 msg/sec
                await new Promise(r => setTimeout(r, 1000));
            }

            setProgress({ sent, failed, total: targets.length, done: true });
            setResult({ success: sent > 0, message: `Campaign complete! Sent: ${sent}, Failed: ${failed}` });
        }

        setSending(false);
    }

    return (
        <>
            <div className="page-header">
                <h1>Campaigns</h1>
                <p>Send personalized WhatsApp messages to your farmers</p>
            </div>

            <div className="grid-2">
                {/* Left Column — Campaign Setup */}
                <div className="glass-card animate-in">
                    <h3 style={{ marginBottom: 16 }}>Campaign Setup</h3>

                    <div className="form-group">
                        <label className="form-label">Campaign Name</label>
                        <input className="form-input" placeholder="e.g., Crop Survey - Maharashtra" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
                    </div>

                    <div className="toggle-wrapper" onClick={() => setTestMode(!testMode)} style={{ cursor: 'pointer' }}>
                        <div className={`toggle ${testMode ? 'active' : ''}`}></div>
                        <span className="toggle-label">Test Mode (single number)</span>
                    </div>

                    {testMode ? (
                        <>
                            <div className="form-group">
                                <label className="form-label">Test Phone Number</label>
                                <input className="form-input" placeholder="e.g., 918626026537" value={testPhone} onChange={e => setTestPhone(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Test Name (for personalization)</label>
                                <input className="form-input" placeholder="e.g., Ramesh" value={testName} onChange={e => setTestName(e.target.value)} />
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Audience Filters */}
                            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: 16, marginBottom: 16 }}>
                                <h3 style={{ marginBottom: 12, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
                                    Target Audience
                                </h3>

                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">State</label>
                                    <select className="form-select" value={filterState} onChange={e => { setFilterState(e.target.value); setFilterDistrict('ALL'); }}>
                                        <option value="ALL">All States</option>
                                        {states.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">District</label>
                                    <select className="form-select" value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
                                        <option value="ALL">All Districts</option>
                                        {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>

                                <div className="form-group" style={{ marginBottom: 8 }}>
                                    <label className="form-label">Language</label>
                                    <select className="form-select" value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
                                        <option value="ALL">All Languages</option>
                                        {languages.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Audience Summary */}
                            <div className="alert alert-info" style={{ marginBottom: 12 }}>
                                <strong>{filteredFarmers.length}</strong> farmers match your filters (out of {allFarmers.length} total)
                            </div>

                            {filteredFarmers.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.82rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        onClick={() => setShowAudience(!showAudience)}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showAudience ? 'rotate(180deg)' : 'none', transition: '0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
                                        {showAudience ? 'Hide' : 'Preview'} Audience List
                                    </button>
                                </div>
                            )}

                            {showAudience && filteredFarmers.length > 0 && (
                                <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: '0.82rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', padding: 8, border: '1px solid var(--border-subtle)' }}>
                                    {filteredFarmers.map((f, i) => (
                                        <div key={i} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 500 }}>{f.full_name || '—'}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{f.phone_number}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Right Column — Message */}
                <div className="glass-card animate-in" style={{ animationDelay: '0.1s' }}>
                    <h3 style={{ marginBottom: 16 }}>Message</h3>

                    <div className="form-group">
                        <label className="form-label">Message Type</label>
                        <select className="form-select" value={messageType} onChange={e => setMessageType(e.target.value)}>
                            <option value="template">Template (recommended)</option>
                            <option value="text">Plain Text</option>
                        </select>
                    </div>

                    {messageType === 'template' ? (
                        <>
                            <div className="form-group">
                                <label className="form-label">Template Name</label>
                                <input className="form-input" value={templateName} onChange={e => setTemplateName(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Language</label>
                                <select className="form-select" value={templateLang} onChange={e => setTemplateLang(e.target.value)}>
                                    <option value="en">English</option>
                                    <option value="en_US">English (US)</option>
                                    <option value="hi">Hindi</option>
                                    <option value="mr">Marathi</option>
                                    <option value="ta">Tamil</option>
                                    <option value="te">Telugu</option>
                                    <option value="bn">Bengali</option>
                                    <option value="gu">Gujarati</option>
                                </select>
                            </div>
                            <div className="alert alert-info">
                                <strong>Tip:</strong> In live mode, each farmer's <strong>name</strong> is automatically sent as the template parameter.
                                <br /><small style={{ color: 'var(--text-muted)' }}>Use <code>crop_survey_invite</code> for personalized messages, or <code>hello_world</code> for generic.</small>
                            </div>
                        </>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">Message Text</label>
                            <textarea className="form-textarea" value={messageText} onChange={e => setMessageText(e.target.value)} />
                            <small style={{ color: 'var(--text-muted)' }}>Use <code>{'{name}'}</code> to insert farmer's name</small>
                        </div>
                    )}
                </div>
            </div>

            {/* Send Button */}
            <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
                    {sending ? <><span className="loading"></span> Sending...</> : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                            {testMode ? 'Send Test' : `Send to ${filteredFarmers.length} Farmers`}
                        </>
                    )}
                </button>
                {!testMode && filteredFarmers.length > 50 && (
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Est. time: ~{Math.ceil(filteredFarmers.length / 60)} min
                    </span>
                )}
            </div>

            {/* Progress (live mode) */}
            {!testMode && progress.total > 0 && (
                <div className="glass-card animate-in" style={{ marginTop: 20 }}>
                    <h3 style={{ marginBottom: 12 }}>Progress</h3>
                    <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${((progress.sent + progress.failed) / progress.total) * 100}%` }}></div>
                    </div>
                    <p style={{ marginTop: 8, fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', gap: '16px' }}>
                        <span><strong style={{ color: 'var(--success-text)' }}>Sent:</strong> {progress.sent}</span>
                        <span><strong style={{ color: 'var(--error-text)' }}>Failed:</strong> {progress.failed}</span>
                        <span><strong>Total:</strong> {progress.total}</span>
                        {progress.done && <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>— Complete!</span>}
                    </p>
                </div>
            )}

            {/* Result */}
            {result && (
                <div className={`alert ${result.success ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 16 }}>
                    <strong>{result.success ? 'Success: ' : 'Error: '}</strong> {result.message || result.error || (result.success ? 'Message sent successfully!' : 'Failed to send')}
                </div>
            )}

            {result && (
                <div className="glass-card" style={{ marginTop: 12 }}>
                    <h3 style={{ marginBottom: 8 }}>API Response</h3>
                    <pre style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </>
    );
}
