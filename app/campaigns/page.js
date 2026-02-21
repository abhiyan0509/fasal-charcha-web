'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CampaignsPage() {
    const [farmerCount, setFarmerCount] = useState(0);
    const [testMode, setTestMode] = useState(true);
    const [messageType, setMessageType] = useState('template');
    const [templateName, setTemplateName] = useState('hello_world');
    const [templateLang, setTemplateLang] = useState('en_US');
    const [messageText, setMessageText] = useState(
        'Namaste {name}! Welcome to Fasal Charcha. Reply HI to start a crop survey!'
    );
    const [testPhone, setTestPhone] = useState('');
    const [campaignName, setCampaignName] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0, done: false });

    useEffect(() => {
        supabase
            .from('farmers')
            .select('*', { count: 'exact', head: true })
            .then(({ count }) => setFarmerCount(count || 0));
    }, []);

    async function handleSend() {
        setSending(true);
        setResult(null);

        if (testMode) {
            // Test mode — single message via API route
            const phone = testPhone.replace(/[^0-9]/g, '');
            if (!phone || phone.length < 10) {
                setResult({ success: false, error: 'Enter a valid phone number' });
                setSending(false);
                return;
            }

            try {
                const endpoint = messageType === 'template' ? '/api/send-template' : '/api/send-message';
                const body = messageType === 'template'
                    ? { to: phone, template_name: templateName, language: templateLang }
                    : { to: phone, message: messageText };

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
            // Live mode — send to all farmers
            const { data: farmers } = await supabase
                .from('farmers')
                .select('full_name, phone_number')
                .limit(1000);

            if (!farmers || farmers.length === 0) {
                setResult({ success: false, error: 'No farmers in database' });
                setSending(false);
                return;
            }

            setProgress({ sent: 0, failed: 0, total: farmers.length, done: false });

            let sent = 0, failed = 0;

            for (const farmer of farmers) {
                const phone = (farmer.phone_number || '').replace(/[^0-9]/g, '');
                if (!phone) { failed++; continue; }

                try {
                    const endpoint = messageType === 'template' ? '/api/send-template' : '/api/send-message';
                    const body = messageType === 'template'
                        ? { to: phone, template_name: templateName, language: templateLang }
                        : { to: phone, message: messageText.replace('{name}', farmer.full_name || 'Farmer') };

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

                setProgress({ sent, failed, total: farmers.length, done: false });

                // Rate limit pause
                await new Promise(r => setTimeout(r, 1000));
            }

            setProgress({ sent, failed, total: farmers.length, done: true });
            setResult({ success: sent > 0, message: `Sent: ${sent}, Failed: ${failed}` });
        }

        setSending(false);
    }

    return (
        <>
            <div className="page-header">
                <h1>📨 Campaigns</h1>
                <p>Send WhatsApp messages to your farmers</p>
            </div>

            <div className="grid-2">
                {/* Left Column */}
                <div className="glass-card animate-in">
                    <h3 style={{ marginBottom: 16 }}>Campaign Setup</h3>

                    <div className="form-group">
                        <label className="form-label">Campaign Name</label>
                        <input className="form-input" placeholder="e.g., Crop Survey Campaign" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
                    </div>

                    <div className="toggle-wrapper" onClick={() => setTestMode(!testMode)} style={{ cursor: 'pointer' }}>
                        <div className={`toggle ${testMode ? 'active' : ''}`}></div>
                        <span className="toggle-label">🧪 Test Mode (one number only)</span>
                    </div>

                    {testMode ? (
                        <div className="form-group">
                            <label className="form-label">Test Phone Number</label>
                            <input className="form-input" placeholder="e.g., 918626026537" value={testPhone} onChange={e => setTestPhone(e.target.value)} />
                        </div>
                    ) : (
                        <div className="alert alert-warning">
                            ⚠️ Live Mode — will send to ALL {farmerCount} farmers!
                        </div>
                    )}
                </div>

                {/* Right Column */}
                <div className="glass-card animate-in" style={{ animationDelay: '0.1s' }}>
                    <h3 style={{ marginBottom: 16 }}>Message</h3>

                    <div className="form-group">
                        <label className="form-label">Message Type</label>
                        <select className="form-select" value={messageType} onChange={e => setMessageType(e.target.value)}>
                            <option value="template">📋 Template (recommended)</option>
                            <option value="text">💬 Plain Text</option>
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
                                    <option value="en_US">English (US)</option>
                                    <option value="hi">Hindi</option>
                                    <option value="mr">Marathi</option>
                                    <option value="ta">Tamil</option>
                                    <option value="te">Telugu</option>
                                    <option value="bn">Bengali</option>
                                    <option value="gu">Gujarati</option>
                                </select>
                            </div>
                            <div className="alert alert-info">💡 The <code>hello_world</code> template is pre-approved and works immediately.</div>
                        </>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">Message Text</label>
                            <textarea className="form-textarea" value={messageText} onChange={e => setMessageText(e.target.value)} />
                        </div>
                    )}
                </div>
            </div>

            {/* Send Button */}
            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
                    {sending ? <><span className="loading"></span> Sending...</> : testMode ? '🚀 Send Test' : '🚀 Send to All'}
                </button>
            </div>

            {/* Progress (live mode) */}
            {!testMode && progress.total > 0 && (
                <div className="glass-card animate-in" style={{ marginTop: 20 }}>
                    <h3 style={{ marginBottom: 12 }}>Progress</h3>
                    <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${((progress.sent + progress.failed) / progress.total) * 100}%` }}></div>
                    </div>
                    <p style={{ marginTop: 8, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        Sent: {progress.sent} | Failed: {progress.failed} | Total: {progress.total}
                    </p>
                </div>
            )}

            {/* Result */}
            {result && (
                <div className={`alert ${result.success ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 16 }}>
                    {result.success ? '✅' : '❌'} {result.message || result.error || (result.success ? 'Message sent successfully!' : 'Failed to send')}
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
