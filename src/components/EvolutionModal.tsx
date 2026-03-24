import type { PendingEvolution } from '../types';
import './EvolutionModal.css';

interface EvolutionModalProps {
  evolution: PendingEvolution;
  onAccept: () => void;
  onDecline: () => void;
}

export function EvolutionModal({ evolution, onAccept, onDecline }: EvolutionModalProps) {
  return (
    <div className="evolution-overlay">
      <div className="evolution-modal">
        <h2 className="evolution-title">Evolution !</h2>
        <div className="evolution-display">
          <div className="evolution-pokemon">
            <img src={evolution.fromSprite} alt={evolution.fromFrenchName} className="evolution-sprite" />
            <span className="evolution-name">{evolution.fromFrenchName || evolution.fromName}</span>
          </div>
          <div className="evolution-arrow">→</div>
          <div className="evolution-pokemon">
            <img src={evolution.intoSprite} alt={evolution.intoFrenchName} className="evolution-sprite glow" />
            <span className="evolution-name">{evolution.intoFrenchName || evolution.intoName}</span>
          </div>
        </div>
        <p className="evolution-question">
          Voulez-vous faire evoluer {evolution.fromFrenchName || evolution.fromName} en {evolution.intoFrenchName || evolution.intoName} ?
        </p>
        <div className="evolution-buttons">
          <button className="evolution-btn accept" onClick={onAccept}>
            Evoluer !
          </button>
          <button className="evolution-btn decline" onClick={onDecline}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
