/**
 * Parses LLM responses into valid Pokemon Showdown choice commands
 */
export class ResponseParser {
  /**
   * Parse an LLM response into a valid choice command
   * Returns null if parsing fails
   */
  static parse(response: string, request: any): string | null {
    const text = response.toLowerCase().trim();

    // Try to extract move command
    const moveMatch = text.match(/\b(?:move|use|attack)\s*(\d+)\b/i);
    if (moveMatch) {
      const moveNum = parseInt(moveMatch[1], 10);
      if (moveNum >= 1 && moveNum <= 4) {
        // Verify the move is valid
        if (this.isValidMove(moveNum, request)) {
          return `move ${moveNum}`;
        }
      }
    }

    // Try to extract switch command
    const switchMatch = text.match(/\b(?:switch|swap|change)\s*(?:to\s*)?(\d+)\b/i);
    if (switchMatch) {
      const switchNum = parseInt(switchMatch[1], 10);
      if (switchNum >= 2 && switchNum <= 6) {
        if (this.isValidSwitch(switchNum, request)) {
          return `switch ${switchNum}`;
        }
      }
    }

    // Try to match Pokemon name for switch
    if (request.side?.pokemon) {
      for (let i = 1; i < request.side.pokemon.length; i++) {
        const pokemon = request.side.pokemon[i];
        const name = pokemon.details.split(',')[0].toLowerCase();
        if (text.includes(name) && !pokemon.condition.endsWith(' fnt')) {
          return `switch ${i + 1}`;
        }
      }
    }

    // Try to match move name
    if (request.active?.[0]?.moves) {
      for (let i = 0; i < request.active[0].moves.length; i++) {
        const move = request.active[0].moves[i];
        const moveName = move.move.toLowerCase();
        if (text.includes(moveName) && !move.disabled) {
          return `move ${i + 1}`;
        }
      }
    }

    // Check for "default" in team preview
    if (request.teamPreview && text.includes('default')) {
      return 'default';
    }

    // Check for team order (e.g., "312456")
    if (request.teamPreview) {
      const orderMatch = text.match(/\b([1-6]{6})\b/);
      if (orderMatch) {
        return `team ${orderMatch[1]}`;
      }
    }

    return null;
  }

  /**
   * Check if a move number is valid given the current request
   */
  private static isValidMove(moveNum: number, request: any): boolean {
    if (!request.active?.[0]?.moves) return false;

    const moves = request.active[0].moves;
    if (moveNum < 1 || moveNum > moves.length) return false;

    const move = moves[moveNum - 1];
    return !move.disabled;
  }

  /**
   * Check if a switch is valid given the current request
   */
  private static isValidSwitch(switchNum: number, request: any): boolean {
    if (!request.side?.pokemon) return false;

    // Check if trapped (can't switch)
    if (request.active?.[0]?.trapped) return false;

    const pokemon = request.side.pokemon;
    if (switchNum < 2 || switchNum > pokemon.length) return false;

    const targetPokemon = pokemon[switchNum - 1];

    // Can't switch to fainted Pokemon
    if (targetPokemon.condition.endsWith(' fnt')) return false;

    // Can't switch to already active Pokemon
    if (targetPokemon.active) return false;

    return true;
  }

  /**
   * Get a random valid choice as fallback
   */
  static getRandomValidChoice(request: any): string {
    // Handle force switch
    if (request.forceSwitch) {
      const validSwitches = this.getValidSwitches(request);
      if (validSwitches.length > 0) {
        return `switch ${validSwitches[Math.floor(Math.random() * validSwitches.length)]}`;
      }
      return 'pass';
    }

    // Handle team preview
    if (request.teamPreview) {
      return 'default';
    }

    // Handle normal move request
    if (request.active?.[0]) {
      const validMoves = this.getValidMoves(request);
      const validSwitches = request.active[0].trapped ? [] : this.getValidSwitches(request);

      const allChoices = [
        ...validMoves.map(m => `move ${m}`),
        ...validSwitches.map(s => `switch ${s}`),
      ];

      if (allChoices.length > 0) {
        return allChoices[Math.floor(Math.random() * allChoices.length)];
      }
    }

    return 'pass';
  }

  private static getValidMoves(request: any): number[] {
    if (!request.active?.[0]?.moves) return [];

    return request.active[0].moves
      .map((m: any, i: number) => ({ move: m, index: i + 1 }))
      .filter((m: any) => !m.move.disabled)
      .map((m: any) => m.index);
  }

  private static getValidSwitches(request: any): number[] {
    if (!request.side?.pokemon) return [];

    return request.side.pokemon
      .map((p: any, i: number) => ({ pokemon: p, index: i + 1 }))
      .filter((p: any) => p.index > 1 && !p.pokemon.condition.endsWith(' fnt') && !p.pokemon.active)
      .map((p: any) => p.index);
  }
}
