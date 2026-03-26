import { useAuth } from '../context/AuthContext';
import type { Page } from '../App';
import './Header.css';

const TABS: { page: Page; label: string }[] = [
  { page: 'team', label: 'Equipe' },
  { page: 'explore', label: 'Explorer' },
  { page: 'pokedex', label: 'Pokedex' },
  { page: 'combat', label: 'Combat' },
  { page: 'social', label: 'Amis' },
];

export function Header({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  const { displayName, signOut } = useAuth();

  return (
    <header className="app-header">
      <div className="header-top">
        <div className="pokeball-logo" />
        <h1>Poke Martin</h1>
        {displayName && (
          <div className="header-user">
            <span className="header-username">{displayName}</span>
            <button className="header-logout" onClick={signOut} title="Deconnexion">
              &times;
            </button>
          </div>
        )}
      </div>
      <nav className="header-nav">
        {TABS.map(tab => (
          <button
            key={tab.page}
            className={`nav-tab${page === tab.page ? ' active' : ''}`}
            onClick={() => onNavigate(tab.page)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
