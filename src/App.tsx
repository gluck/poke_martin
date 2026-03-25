import { useEffect, useState, useCallback } from 'react'
import { Header } from './components/Header'
import { PokemonSearch } from './components/PokemonSearch'
import { PlayerList } from './components/PlayerList'
import { BattleArena } from './components/BattleArena'
import { EvolutionModal } from './components/EvolutionModal'
import { AuthPage } from './components/AuthPage'
import { FriendsList } from './components/FriendsList'
import { OnlineBattleArena } from './components/OnlineBattleArena'
import { BattleHistory } from './components/BattleHistory'
import { ChallengeNotification } from './components/ChallengeNotification'
import { getFrenchNameIndex, getFrenchNameIndexSync } from './api/frenchNames'
import { useGame } from './context/GameContext'
import { useAuth } from './context/AuthContext'
import { transformApiPokemon } from './api/pokeapi'
import type { PokeAPIPokemon } from './types'
import './App.css'

function App() {
  const { user, loading: authLoading } = useAuth();
  const [indexReady, setIndexReady] = useState(() => getFrenchNameIndexSync() !== null);
  const { state, dispatch, loading: gameLoading } = useGame();

  useEffect(() => {
    if (!indexReady) {
      getFrenchNameIndex().then(() => setIndexReady(true));
    }
  }, [indexReady]);

  const handleAcceptEvolution = useCallback(async () => {
    const evo = state.pendingEvolution;
    if (!evo) return;

    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${evo.intoSpeciesId}`);
      if (!res.ok) throw new Error('fetch failed');
      const raw: PokeAPIPokemon = await res.json();
      const evolvedPokemon = await transformApiPokemon(raw);
      dispatch({ type: 'EVOLVE_POKEMON', playerId: evo.playerId, pokemonId: evo.pokemonId, evolvedPokemon });
    } catch {
      // If fetch fails, just dismiss
    }
    dispatch({ type: 'CLEAR_PENDING_EVOLUTION' });
  }, [state.pendingEvolution, dispatch]);

  const handleDeclineEvolution = useCallback(() => {
    dispatch({ type: 'CLEAR_PENDING_EVOLUTION' });
  }, [dispatch]);

  if (authLoading) {
    return (
      <div className="app loading-screen">
        <div className="auth-pokeball" />
        <p>Chargement...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="app">
      <Header />
      {(gameLoading || !indexReady) && (
        <div className="loading-banner">
          {gameLoading ? 'Chargement de tes Pokemon...' : "Chargement de l'index des Pokemon..."}
        </div>
      )}
      <main className="app-main">
        <PokemonSearch />
        <PlayerList />
        <BattleArena />
        <FriendsList />
        <OnlineBattleArena />
        <BattleHistory />
      </main>
      <ChallengeNotification />
      {state.pendingEvolution && (
        <EvolutionModal
          evolution={state.pendingEvolution}
          onAccept={handleAcceptEvolution}
          onDecline={handleDeclineEvolution}
        />
      )}
      <footer className="app-footer">
        v{__APP_VERSION__} ({__COMMIT_HASH__})
      </footer>
    </div>
  )
}

export default App
