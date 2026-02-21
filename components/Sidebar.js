'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    {
        section: 'Overview', items: [
            { href: '/', icon: '📊', label: 'Dashboard' },
        ]
    },
    {
        section: 'Manage', items: [
            { href: '/farmers', icon: '🌾', label: 'Farmers' },
            { href: '/campaigns', icon: '📨', label: 'Campaigns' },
            { href: '/responses', icon: '📋', label: 'Survey Responses' },
        ]
    },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-icon">🌿</div>
                <div>
                    <h2>Fasal Charcha</h2>
                    <div className="logo-sub">Farmer Dashboard</div>
                </div>
            </div>

            {navItems.map((section) => (
                <nav key={section.section} className="nav-section">
                    <div className="nav-section-title">{section.section}</div>
                    {section.items.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-link ${pathname === item.href ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>
            ))}

            <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    🟢 Connected to Supabase
                </div>
            </div>
        </aside>
    );
}
