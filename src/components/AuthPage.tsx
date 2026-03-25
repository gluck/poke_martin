import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmed = username.trim();
    if (!trimmed) {
      setError('Choisis un nom de dresseur');
      setLoading(false);
      return;
    }

    if (isRegister) {
      const err = await signUp(trimmed, password);
      if (err) setError(err);
    } else {
      const err = await signIn(trimmed, password);
      if (err) setError(err);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-pokeball" />
          <h1>Poke Martin</h1>
        </div>
        <h2>{isRegister ? 'Inscription' : 'Connexion'}</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Nom de dresseur"
            className="auth-input"
            required
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="auth-input"
            required
            minLength={6}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '...' : isRegister ? "S'inscrire" : 'Se connecter'}
          </button>
        </form>
        {error && <p className="auth-error">{error}</p>}
        <button
          className="auth-toggle"
          onClick={() => { setIsRegister(!isRegister); setError(''); }}
        >
          {isRegister ? 'Deja un compte ? Se connecter' : 'Pas de compte ? Inscription'}
        </button>
      </div>
    </div>
  );
}
