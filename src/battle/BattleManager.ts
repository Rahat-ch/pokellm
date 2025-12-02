import type { LLMConfig } from '../llm/types.js';

// Stub implementation - will be fully implemented later
class ActiveBattle {
  public turn = 0;
  private log: string[] = [];

  getLog() {
    return this.log;
  }

  async forceEnd() {
    // TODO: Implement
  }
}

class BattleManager {
  private activeBattle: ActiveBattle | null = null;

  async startBattle(p1: LLMConfig, p2: LLMConfig, format?: string): Promise<string> {
    if (this.activeBattle) {
      throw new Error('Battle already in progress');
    }

    // TODO: Implement actual battle logic
    console.log(`Starting battle: ${p1.provider}/${p1.model} vs ${p2.provider}/${p2.model}`);

    this.activeBattle = new ActiveBattle();
    return `battle-${Date.now()}`;
  }

  getStatus() {
    if (!this.activeBattle) {
      return { active: false };
    }
    return {
      active: true,
      turn: this.activeBattle.turn,
    };
  }

  getCurrentBattle() {
    return this.activeBattle;
  }
}

export const battleManager = new BattleManager();
