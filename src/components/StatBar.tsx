import './StatBar.css';

const statColors: Record<string, string> = {
  HP: '#FF5959',
  ATK: '#F5AC78',
  DEF: '#FAE078',
  SPA: '#9DB7F5',
  SPD: '#A7DB8D',
  SPE: '#FA92B2',
};

const statLabels: Record<string, string> = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  spAtk: 'SPA',
  spDef: 'SPD',
  speed: 'SPE',
};

export function StatBar({ statKey, value }: { statKey: string; value: number }) {
  const label = statLabels[statKey] || statKey;
  const color = statColors[label] || '#888';
  const pct = Math.min((value / 255) * 100, 100);

  return (
    <div className="stat-bar">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <div className="stat-track">
        <div className="stat-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
