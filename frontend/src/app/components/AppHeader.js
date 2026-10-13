import Link from 'next/link';
import { ClipboardList, QrCode, Truck } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function AppHeader({ active = 'registro' }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-link" aria-label="Controle de Pátio, página inicial">
          <span className="brand-mark"><Truck size={19} strokeWidth={2.3} aria-hidden="true" /></span>
          <span className="brand-copy">
            <span className="brand-name">Controle de Pátio</span>
            <span className="brand-caption">Operação de entregas</span>
          </span>
        </Link>
        <nav className="main-nav" aria-label="Navegação principal">
          <Link href="/" className="nav-link" aria-label="Registro" title="Registro" aria-current={active === 'registro' ? 'page' : undefined}>
            <Truck size={16} aria-hidden="true" />
            <span className="nav-label">Registro</span>
          </Link>
          {active !== 'registro' && (
            <Link href="/qr" className="nav-link" aria-label="QR da unidade" title="QR da unidade" aria-current={active === 'qr' ? 'page' : undefined}>
              <QrCode size={16} aria-hidden="true" />
              <span className="nav-label">QR da unidade</span>
            </Link>
          )}
          <Link href="/admin" className="nav-link" aria-label="Admin" title="Admin" aria-current={active === 'admin' ? 'page' : undefined}>
            <ClipboardList size={16} aria-hidden="true" />
            <span className="nav-label">Admin</span>
          </Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}