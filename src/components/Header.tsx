import { useAuth } from '../context/AuthContext';
import './Header.css';

export function Header() {
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
      <div className="header-divider">
        <div className="divider-ball" />
      </div>
    </header>
  );
}
