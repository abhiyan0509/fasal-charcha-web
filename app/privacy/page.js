export default function PrivacyPolicy() {
    return (
        <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '40px 20px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#e0e0e0',
            background: '#0a0a0a',
            minHeight: '100vh',
            lineHeight: '1.7'
        }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Privacy Policy</h1>
            <p style={{ color: '#888', marginBottom: '32px' }}>Fasal Charcha — Agricultural Survey Platform</p>
            <p style={{ color: '#888', marginBottom: '32px' }}>Last updated: March 20, 2026</p>

            <h2 style={{ fontSize: '1.3rem', marginTop: '28px' }}>1. Information We Collect</h2>
            <p>When you interact with the Fasal Charcha WhatsApp bot, we collect:</p>
            <ul>
                <li>Your phone number (for communication)</li>
                <li>Your name (if provided)</li>
                <li>Survey responses you submit (crop data, farming practices)</li>
                <li>Voice messages (temporarily processed for transcription)</li>
                <li>Language preference you choose</li>
            </ul>

            <h2 style={{ fontSize: '1.3rem', marginTop: '28px' }}>2. How We Use Your Information</h2>
            <ul>
                <li>To conduct agricultural surveys and collect crop data</li>
                <li>To provide you with personalized farming advice</li>
                <li>To send you relevant agricultural updates</li>
                <li>To improve our services and research</li>
            </ul>

            <h2 style={{ fontSize: '1.3rem', marginTop: '28px' }}>3. Data Storage and Security</h2>
            <p>Your data is stored securely on Supabase (cloud database) and is protected using industry-standard encryption. Voice messages are processed in real-time and are not stored permanently.</p>

            <h2 style={{ fontSize: '1.3rem', marginTop: '28px' }}>4. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul>
                <li><strong>WhatsApp Business API (Meta)</strong> — for messaging</li>
                <li><strong>Sarvam AI</strong> — for language translation and voice transcription</li>
                <li><strong>Supabase</strong> — for data storage</li>
            </ul>

            <h2 style={{ fontSize: '1.3rem', marginTop: '28px' }}>5. Your Rights</h2>
            <p>You can request deletion of your data at any time by messaging &quot;DELETE MY DATA&quot; to our WhatsApp number. You may also contact us to access or modify your personal information.</p>

            <h2 style={{ fontSize: '1.3rem', marginTop: '28px' }}>6. Contact</h2>
            <p>For questions about this privacy policy, contact us via WhatsApp or email at the address associated with this service.</p>

            <p style={{ color: '#666', marginTop: '40px', fontSize: '0.9rem' }}>This project is developed as part of the BITSoM AIAP program for academic and research purposes.</p>
        </div>
    );
}
