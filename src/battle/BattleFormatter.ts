/**
 * Formats battle state into a human-readable prompt for LLMs
 */
export class BattleFormatter {
  /**
   * Format a ChoiceRequest into a prompt for the LLM
   */
  static formatRequest(request: any, battleLog: string[], turn: number): string {
    const parts: string[] = [];

    parts.push(`TURN ${turn}`);
    parts.push('');

    // Format active Pokemon and available moves
    if (request.active && request.active[0]) {
      const active = request.active[0];
      const pokemon = request.side.pokemon[0];

      parts.push('YOUR ACTIVE POKEMON:');
      parts.push(this.formatPokemon(pokemon, true));
      parts.push('');

      // Available moves
      if (active.moves && active.moves.length > 0) {
        parts.push('AVAILABLE MOVES:');
        active.moves.forEach((move: any, i: number) => {
          const disabled = move.disabled ? ' (DISABLED)' : '';
          const pp = move.pp !== undefined ? ` - ${move.pp}/${move.maxpp} PP` : '';
          parts.push(`${i + 1}. ${move.move}${pp}${disabled}`);
        });
        parts.push('');
      }

      // Can switch?
      if (!active.trapped) {
        const canSwitch = request.side.pokemon
          .slice(1)
          .filter((p: any) => !p.condition.endsWith(' fnt'))
          .map((p: any, i: number) => `${i + 2}. ${p.details.split(',')[0]} - ${p.condition}`);

        if (canSwitch.length > 0) {
          parts.push('AVAILABLE SWITCHES:');
          canSwitch.forEach((s: string) => parts.push(s));
          parts.push('');
        }
      } else {
        parts.push('(You are TRAPPED and cannot switch)');
        parts.push('');
      }
    }

    // Format team
    parts.push('YOUR TEAM:');
    request.side.pokemon.forEach((pokemon: any, i: number) => {
      const active = i === 0 ? ' (active)' : '';
      const fainted = pokemon.condition.endsWith(' fnt') ? ' [FAINTED]' : '';
      parts.push(`${i + 1}. ${pokemon.details.split(',')[0]} - ${pokemon.condition}${active}${fainted}`);
    });
    parts.push('');

    // Recent battle events (last 10 lines that are relevant)
    const recentEvents = this.getRecentEvents(battleLog);
    if (recentEvents.length > 0) {
      parts.push('RECENT EVENTS:');
      recentEvents.forEach(e => parts.push(`- ${e}`));
      parts.push('');
    }

    // Instructions
    parts.push('---');
    parts.push('Choose your action. Respond with ONLY one of:');
    parts.push('- "move N" where N is 1-4 to use that move');
    parts.push('- "switch N" where N is 2-6 to switch to that Pokemon');
    parts.push('');
    parts.push('Example: "move 1" or "switch 3"');

    return parts.join('\n');
  }

  /**
   * Format a force switch request
   */
  static formatForceSwitch(request: any, battleLog: string[], turn: number): string {
    const parts: string[] = [];

    parts.push(`TURN ${turn} - FORCED SWITCH`);
    parts.push('');
    parts.push('Your Pokemon fainted! You must switch to another Pokemon.');
    parts.push('');

    // Available switches
    parts.push('AVAILABLE POKEMON:');
    request.side.pokemon.forEach((pokemon: any, i: number) => {
      if (i === 0) return; // Skip fainted active
      const fainted = pokemon.condition.endsWith(' fnt') ? ' [FAINTED]' : '';
      if (!fainted) {
        parts.push(`${i + 1}. ${pokemon.details.split(',')[0]} - ${pokemon.condition}`);
      }
    });
    parts.push('');

    parts.push('---');
    parts.push('Choose which Pokemon to switch to.');
    parts.push('Respond with ONLY "switch N" where N is the Pokemon number (2-6).');
    parts.push('');
    parts.push('Example: "switch 2"');

    return parts.join('\n');
  }

  /**
   * Format team preview request
   */
  static formatTeamPreview(request: any): string {
    const parts: string[] = [];

    parts.push('TEAM PREVIEW');
    parts.push('');
    parts.push('Your team:');
    request.side.pokemon.forEach((pokemon: any, i: number) => {
      parts.push(`${i + 1}. ${pokemon.details.split(',')[0]}`);
    });
    parts.push('');
    parts.push('---');
    parts.push('Choose your lead Pokemon order or use default.');
    parts.push('Respond with "default" to use standard order, or specify order like "312456"');

    return parts.join('\n');
  }

  private static formatPokemon(pokemon: any, showMoves = false): string {
    const name = pokemon.details.split(',')[0];
    const condition = pokemon.condition;
    const status = this.extractStatus(condition);

    let result = `${name} - HP: ${condition}`;
    if (status) {
      result += ` [${status}]`;
    }

    return result;
  }

  private static extractStatus(condition: string): string | null {
    if (condition.includes(' brn')) return 'BURNED';
    if (condition.includes(' par')) return 'PARALYZED';
    if (condition.includes(' slp')) return 'ASLEEP';
    if (condition.includes(' frz')) return 'FROZEN';
    if (condition.includes(' psn')) return 'POISONED';
    if (condition.includes(' tox')) return 'BADLY POISONED';
    return null;
  }

  private static getRecentEvents(battleLog: string[]): string[] {
    const events: string[] = [];
    const relevantPrefixes = ['|move|', '|-damage|', '|-heal|', '|switch|', '|faint|', '|-status|', '|-boost|', '|-unboost|'];

    // Get last chunk and parse relevant lines
    const lastChunks = battleLog.slice(-3).join('\n');
    const lines = lastChunks.split('\n');

    for (const line of lines) {
      for (const prefix of relevantPrefixes) {
        if (line.startsWith(prefix)) {
          events.push(this.formatEvent(line));
          break;
        }
      }
    }

    return events.slice(-10); // Last 10 events
  }

  private static formatEvent(line: string): string {
    const parts = line.split('|').filter(Boolean);
    const type = parts[0];

    switch (type) {
      case 'move':
        return `${parts[1]} used ${parts[2]}`;
      case '-damage':
        return `${parts[1]} took damage (${parts[2]})`;
      case '-heal':
        return `${parts[1]} healed (${parts[2]})`;
      case 'switch':
        return `${parts[1]} switched in`;
      case 'faint':
        return `${parts[1]} fainted`;
      case '-status':
        return `${parts[1]} was inflicted with ${parts[2]}`;
      case '-boost':
        return `${parts[1]}'s ${parts[2]} rose`;
      case '-unboost':
        return `${parts[1]}'s ${parts[2]} fell`;
      default:
        return line;
    }
  }
}
