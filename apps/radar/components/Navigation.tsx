'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radar, HelpCircle, Activity, ExternalLink, Terminal } from 'lucide-react';
import { MethodologyModal } from './MethodologyModal';

export function Navigation() {
  const pathname = usePathname();
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  return (
    <>
      <header className="global-topbar">
        <div className="topbar-left">
          <Link href="/" className="brand-lockup">
            <div className="radar-radar-icon">
              <Radar size={19} className="radar-spin-subtle" />
            </div>
            <div className="brand-text">
              <span className="brand-main">AI Education Innovation Radar</span>
              <span className="brand-sub">BeLEARN Booster · PHBern</span>
            </div>
          </Link>

          <div className="system-status-indicator">
            <span className="status-ping" />
            <span className="status-label">OBSERVATION MODE</span>
          </div>
        </div>

        <nav className="topbar-nav">
          <Link
            href="/"
            className={`nav-link ${pathname === '/' ? 'active' : ''}`}
          >
            Radar Map
          </Link>
          <Link
            href="/signals"
            className={`nav-link ${pathname.startsWith('/signals') ? 'active' : ''}`}
          >
            Signals
          </Link>
          <Link
            href="/clusters"
            className={`nav-link ${pathname.startsWith('/clusters') ? 'active' : ''}`}
          >
            Clusters
          </Link>

          <button
            type="button"
            className="nav-methodology-btn"
            onClick={() => setMethodologyOpen(true)}
          >
            <HelpCircle size={14} />
            <span>Methodology</span>
          </button>

          <Link
            href="/mcp"
            className={`nav-mcp-pill ${pathname === '/mcp' ? 'active' : ''}`}
            title="Read-only Model Context Protocol Endpoint"
          >
            <Terminal size={13} />
            <span>MCP</span>
          </Link>
        </nav>
      </header>

      <div className="demo-data-banner" role="note">
        <strong>DEMONSTRATION DATASET</strong>
        <span>Verified public projects are mixed with clearly labelled illustrative scenarios for interface testing. No demo record should be treated as validated evidence without source review.</span>
      </div>

      <MethodologyModal
        isOpen={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
      />
    </>
  );
}
