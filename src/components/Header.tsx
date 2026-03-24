import './Header.css';

export function Header() {
  return (
    <header className="app-header">
      <div className="header-top">
        <div className="pokeball-logo" />
        <h1>Poke Martin</h1>
      </div>
      <div className="header-divider">
        <div className="divider-ball" />
      </div>
    </header>
  );
}
