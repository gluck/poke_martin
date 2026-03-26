export interface Region {
  name: string;
  pokedexId: number;
  color: string;
  image: string;
}

export const REGIONS: Region[] = [
  { name: 'Kanto', pokedexId: 2, color: '#DC0A2D', image: '/region_kanto.png' },
  { name: 'Johto', pokedexId: 3, color: '#DAA520', image: '/region_johto.png' },
  { name: 'Hoenn', pokedexId: 4, color: '#2E8B57', image: '/region_hoenn.png' },
  { name: 'Sinnoh', pokedexId: 5, color: '#4169E1', image: '/region_sinnoh.png' },
  { name: 'Unova', pokedexId: 8, color: '#555', image: '/region_unova.png' },
  { name: 'Kalos', pokedexId: 12, color: '#9B59B6', image: '/region_kalos.png' },
  { name: 'Alola', pokedexId: 16, color: '#F39C12', image: '/region_alola.png' },
  { name: 'Galar', pokedexId: 27, color: '#E74C3C', image: '/region_galar.png' },
  { name: 'Paldea', pokedexId: 31, color: '#1ABC9C', image: '/region_paldea.png' },
];

export const STARTER_IDS = [
  1, 4, 7, 25,       // Gen 1
  152, 155, 158,      // Gen 2
  252, 255, 258,      // Gen 3
  387, 390, 393,      // Gen 4
  495, 498, 501,      // Gen 5
  650, 653, 656,      // Gen 6
  722, 725, 728,      // Gen 7
  810, 813, 816,      // Gen 8
  906, 909, 912,      // Gen 9
];
