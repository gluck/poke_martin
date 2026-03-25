import { useState } from 'react';
import { useBattleHistory, type BattleHistoryEntry } from '../hooks/useBattleHistory';
import { BattleLog } from './BattleLog';
import './BattleHistory.css';

export function BattleHistory() {
  const { history, loading } = useBattleHistory();
  const [selectedBattle, setSelectedBattle] = useState<BattleHistoryEntry | null>(null);

  return (
    <section className="battle-history">
      <h2>Historique des combats</h2>
      {loading ? (
        <p className="history-loading">Chargement...</p>
      ) : history.length === 0 ? (
        <p className="no-history">Aucun combat en ligne pour le moment.</p>
      ) : (
        <div className="history-list">
          {history.map(entry => {
            const date = new Date(entry.createdAt);
            const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            return (
              <div
                key={entry.id}
                className="history-entry"
                onClick={() => setSelectedBattle(entry)}
              >
                <div className="history-match">
                  <span className={`history-player ${entry.winnerName === entry.player1Name ? 'winner' : ''}`}>
                    {entry.player1Name}
                  </span>
                  <span className="history-vs">vs</span>
                  <span className={`history-player ${entry.winnerName === entry.player2Name ? 'winner' : ''}`}>
                    {entry.player2Name}
                  </span>
                </div>
                <div className="history-result">
                  {entry.winnerName
                    ? <span className="history-winner">{entry.winnerName} gagne !</span>
                    : <span className="history-draw">Match nul</span>
                  }
                </div>
                <span className="history-date">{dateStr}</span>
              </div>
            );
          })}
        </div>
      )}

      {selectedBattle && (
        <BattleLog
          result={selectedBattle.battleResult}
          onClose={() => setSelectedBattle(null)}
        />
      )}
    </section>
  );
}
