// Pokemon Showdown sprite CDN
const SPRITE_BASE = 'https://play.pokemonshowdown.com/sprites';

export interface ActivePokemon {
  name: string;
  species: string;
  level: number;
  hp: number;
  maxHp: number;
  hpPercent: number;
  status: string | null; // brn, par, psn, tox, slp, frz
  fainted: boolean;
  boosts: Record<string, number>;
}

export interface TeamMember {
  species: string;
  name: string;
  fainted: boolean;
  active: boolean;
}

export interface BattleField {
  weather: string | null;
  terrain: string | null;
}

export interface MoveAnnouncement {
  pokemon: string;
  move: string;
}

export interface VisualBattleState {
  p1Pokemon: ActivePokemon | null;
  p2Pokemon: ActivePokemon | null;
  p1Team: TeamMember[];
  p2Team: TeamMember[];
  field: BattleField;
  p1LastMove: MoveAnnouncement | null;
  p2LastMove: MoveAnnouncement | null;
}

/**
 * Convert Pokemon species to sprite-compatible ID
 * Showdown format: baseSpecies-forme (e.g., "charizard-megax", "rotom-wash")
 */
export function toSpriteId(species: string): string {
  // Handle forme variants - keep hyphen between base and forme
  const hyphenIndex = species.indexOf('-');

  if (hyphenIndex === -1) {
    // Simple name like "Pikachu"
    return species.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Split at first hyphen: "Charizard-Mega-X" → ["Charizard", "Mega-X"]
  const base = species.slice(0, hyphenIndex);
  const forme = species.slice(hyphenIndex + 1);

  // "Charizard" → "charizard", "Mega-X" → "megax"
  const baseId = base.toLowerCase().replace(/[^a-z0-9]/g, '');
  const formeId = forme.toLowerCase().replace(/[^a-z0-9]/g, '');

  return `${baseId}-${formeId}`;
}

/**
 * Get sprite URL for a Pokemon
 */
export function getSpriteUrl(species: string, isBack = false): string {
  const id = toSpriteId(species);
  const dir = isBack ? 'ani-back' : 'ani';
  return `${SPRITE_BASE}/${dir}/${id}.gif`;
}

/**
 * Get static sprite as fallback
 */
export function getStaticSpriteUrl(species: string, isBack = false): string {
  const id = toSpriteId(species);
  const dir = isBack ? 'gen5-back' : 'gen5';
  return `${SPRITE_BASE}/${dir}/${id}.png`;
}

/**
 * Get mini sprite URL for team indicator
 * Uses the dex sprites
 */
export function getMiniSpriteUrl(species: string): string {
  const id = toSpriteId(species);
  return `${SPRITE_BASE}/dex/${id}.png`;
}

/**
 * Get list of sprite URLs to try, in order of preference
 * Includes fallbacks for missing animated sprites
 */
export function getSpriteUrlsWithFallbacks(species: string, isBack = false): string[] {
  const id = toSpriteId(species);
  const baseId = id.split('-')[0]; // Fallback to base forme if forme sprite doesn't exist

  if (isBack) {
    return [
      `${SPRITE_BASE}/ani-back/${id}.gif`,      // Animated back
      `${SPRITE_BASE}/gen5-back/${id}.png`,     // Static back
      `${SPRITE_BASE}/ani-back/${baseId}.gif`,  // Base forme animated
      `${SPRITE_BASE}/gen5-back/${baseId}.png`, // Base forme static
    ];
  }

  return [
    `${SPRITE_BASE}/ani/${id}.gif`,      // Animated front
    `${SPRITE_BASE}/gen5/${id}.png`,     // Static front
    `${SPRITE_BASE}/ani/${baseId}.gif`,  // Base forme animated
    `${SPRITE_BASE}/gen5/${baseId}.png`, // Base forme static
  ];
}

/**
 * Get list of mini sprite URLs with fallbacks
 */
export function getMiniSpriteUrlsWithFallbacks(species: string): string[] {
  const id = toSpriteId(species);
  const baseId = id.split('-')[0];

  return [
    `${SPRITE_BASE}/dex/${id}.png`,
    `${SPRITE_BASE}/dex/${baseId}.png`,
  ];
}

/**
 * Parse HP string like "100/100" or "45/100" or "0 fnt"
 */
export function parseHp(hpStr: string): { hp: number; maxHp: number; hpPercent: number; fainted: boolean } {
  if (hpStr.includes('fnt')) {
    return { hp: 0, maxHp: 100, hpPercent: 0, fainted: true };
  }

  // Format: "current/max" or just percentage like "78/100"
  const match = hpStr.match(/(\d+)\/(\d+)/);
  if (match) {
    const hp = parseInt(match[1], 10);
    const maxHp = parseInt(match[2], 10);
    return {
      hp,
      maxHp,
      hpPercent: Math.round((hp / maxHp) * 100),
      fainted: hp === 0,
    };
  }

  // Sometimes it's just a percentage
  const pctMatch = hpStr.match(/(\d+)/);
  if (pctMatch) {
    const pct = parseInt(pctMatch[1], 10);
    return { hp: pct, maxHp: 100, hpPercent: pct, fainted: pct === 0 };
  }

  return { hp: 100, maxHp: 100, hpPercent: 100, fainted: false };
}

/**
 * Parse Pokemon details string like "Pikachu, L84, M" or "Charizard, L100"
 */
export function parseDetails(details: string): { species: string; level: number } {
  const parts = details.split(',').map((s) => s.trim());
  const species = parts[0];
  let level = 100;

  for (const part of parts) {
    if (part.startsWith('L')) {
      level = parseInt(part.slice(1), 10) || 100;
    }
  }

  return { species, level };
}

/**
 * Parse player identifier like "p1a: Pikachu" -> { player: 'p1', name: 'Pikachu' }
 */
export function parsePlayerPokemon(ident: string): { player: 'p1' | 'p2'; name: string } | null {
  const match = ident.match(/^(p[12])[ab]?: (.+)$/);
  if (match) {
    return { player: match[1] as 'p1' | 'p2', name: match[2] };
  }
  return null;
}

/**
 * Create initial visual battle state
 */
export function createInitialVisualState(): VisualBattleState {
  return {
    p1Pokemon: null,
    p2Pokemon: null,
    p1Team: [],
    p2Team: [],
    field: { weather: null, terrain: null },
    p1LastMove: null,
    p2LastMove: null,
  };
}

/**
 * Update visual state from a battle protocol line
 */
export function updateVisualState(state: VisualBattleState, line: string): VisualBattleState {
  const parts = line.split('|');
  const cmd = parts[1];

  switch (cmd) {
    case 'poke': {
      // |poke|p1|Pikachu, L50, M|item
      // Team preview - add to team array
      const player = parts[2] as 'p1' | 'p2';
      if (player !== 'p1' && player !== 'p2') return state;

      const { species } = parseDetails(parts[3] || '');
      const teamKey = player === 'p1' ? 'p1Team' : 'p2Team';

      // Add to team if not already there
      const existingTeam = state[teamKey];
      const alreadyExists = existingTeam.some((m) => m.species === species);
      if (alreadyExists) return state;

      return {
        ...state,
        [teamKey]: [
          ...existingTeam,
          { species, name: species, fainted: false, active: false },
        ],
      };
    }

    case 'switch':
    case 'drag':
    case 'replace': {
      // |switch|p1a: Pikachu|Pikachu, L84, M|100/100
      const parsed = parsePlayerPokemon(parts[2]);
      if (!parsed) return state;

      const { species, level } = parseDetails(parts[3]);
      const { hp, maxHp, hpPercent, fainted } = parseHp(parts[4] || '100/100');

      const pokemon: ActivePokemon = {
        name: parsed.name,
        species,
        level,
        hp,
        maxHp,
        hpPercent,
        status: null,
        fainted,
        boosts: {},
      };

      const pokemonKey = parsed.player === 'p1' ? 'p1Pokemon' : 'p2Pokemon';
      const teamKey = parsed.player === 'p1' ? 'p1Team' : 'p2Team';

      // Update team: mark all as inactive, mark this one as active
      // Also add to team if not present (in case we missed poke message)
      let updatedTeam = state[teamKey].map((m) => ({
        ...m,
        active: m.species === species,
      }));

      // If species not in team, add it
      if (!updatedTeam.some((m) => m.species === species)) {
        updatedTeam = [
          ...updatedTeam,
          { species, name: parsed.name, fainted: false, active: true },
        ];
      }

      return {
        ...state,
        [pokemonKey]: pokemon,
        [teamKey]: updatedTeam,
      };
    }

    case '-damage':
    case '-heal': {
      // |-damage|p1a: Pikachu|Pokemon|45/100
      const parsed = parsePlayerPokemon(parts[2]);
      if (!parsed) return state;

      const key = parsed.player === 'p1' ? 'p1Pokemon' : 'p2Pokemon';
      const current = state[key];
      if (!current) return state;

      const { hp, maxHp, hpPercent, fainted } = parseHp(parts[3]);

      return {
        ...state,
        [key]: { ...current, hp, maxHp, hpPercent, fainted },
      };
    }

    case 'faint': {
      // |faint|p1a: Pikachu
      const parsed = parsePlayerPokemon(parts[2]);
      if (!parsed) return state;

      const pokemonKey = parsed.player === 'p1' ? 'p1Pokemon' : 'p2Pokemon';
      const teamKey = parsed.player === 'p1' ? 'p1Team' : 'p2Team';
      const current = state[pokemonKey];

      // Mark team member as fainted
      const updatedTeam = state[teamKey].map((m) =>
        m.name === parsed.name || m.species === current?.species
          ? { ...m, fainted: true, active: false }
          : m
      );

      return {
        ...state,
        [pokemonKey]: current ? { ...current, hp: 0, hpPercent: 0, fainted: true } : null,
        [teamKey]: updatedTeam,
      };
    }

    case '-status': {
      // |-status|p1a: Pikachu|brn
      const parsed = parsePlayerPokemon(parts[2]);
      if (!parsed) return state;

      const key = parsed.player === 'p1' ? 'p1Pokemon' : 'p2Pokemon';
      const current = state[key];
      if (!current) return state;

      return {
        ...state,
        [key]: { ...current, status: parts[3] },
      };
    }

    case '-curestatus': {
      // |-curestatus|p1a: Pikachu|brn
      const parsed = parsePlayerPokemon(parts[2]);
      if (!parsed) return state;

      const key = parsed.player === 'p1' ? 'p1Pokemon' : 'p2Pokemon';
      const current = state[key];
      if (!current) return state;

      return {
        ...state,
        [key]: { ...current, status: null },
      };
    }

    case '-boost':
    case '-unboost': {
      // |-boost|p1a: Pikachu|atk|1
      const parsed = parsePlayerPokemon(parts[2]);
      if (!parsed) return state;

      const key = parsed.player === 'p1' ? 'p1Pokemon' : 'p2Pokemon';
      const current = state[key];
      if (!current) return state;

      const stat = parts[3];
      const amount = parseInt(parts[4], 10) || 1;
      const change = cmd === '-boost' ? amount : -amount;
      const newBoost = (current.boosts[stat] || 0) + change;

      return {
        ...state,
        [key]: {
          ...current,
          boosts: { ...current.boosts, [stat]: newBoost },
        },
      };
    }

    case '-weather': {
      // |-weather|SunnyDay or |-weather|none
      const weather = parts[2] === 'none' ? null : parts[2];
      return {
        ...state,
        field: { ...state.field, weather },
      };
    }

    case '-fieldstart': {
      // |-fieldstart|move: Electric Terrain
      const terrain = parts[2]?.replace('move: ', '').replace(' Terrain', '');
      return {
        ...state,
        field: { ...state.field, terrain },
      };
    }

    case '-fieldend': {
      return {
        ...state,
        field: { ...state.field, terrain: null },
      };
    }

    case 'move': {
      // |move|p1a: Pikachu|Thunderbolt|p2a: Charizard
      const parsed = parsePlayerPokemon(parts[2]);
      if (!parsed) return state;

      const moveKey = parsed.player === 'p1' ? 'p1LastMove' : 'p2LastMove';
      return {
        ...state,
        [moveKey]: {
          pokemon: parsed.name,
          move: parts[3],
        },
      };
    }

    default:
      return state;
  }
}
