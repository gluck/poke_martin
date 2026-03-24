import { useEffect, useState, useCallback } from 'react'
import { Header } from './components/Header'
import { PokemonSearch } from './components/PokemonSearch'
import { PlayerList } from './components/PlayerList'
import { BattleArena } from './components/BattleArena'
import { EvolutionModal } from './components/EvolutionModal'
import { getFrenchNameIndex, getFrenchNameIndexSync } from './api/frenchNames'
import { useGame } from './context/GameContext'
import { transformApiPokemon } from './api/pokeapi'
import type { PokeAPIPokemon } from './types'
import './App.css'

function App() {
  const [indexReady, setIndexReady] = useState(() => getFrenchNameIndexSync() !== null);
  const { state, dispatch } = useGame();

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

  return (
    <div className="app">
      <Header />
      {!indexReady && (
        <div className="loading-banner">
          Chargement de l'index des Pokemon...
        </div>
      )}
      <main className="app-main">
        <PokemonSearch />
        <PlayerList />
        <BattleArena />
      </main>
      {state.pendingEvolution && (
        <EvolutionModal
          evolution={state.pendingEvolution}
          onAccept={handleAcceptEvolution}
          onDecline={handleDeclineEvolution}
        />
      )}
    </div>
  )
}

export default App
