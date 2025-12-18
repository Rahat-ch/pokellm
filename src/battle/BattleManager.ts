import { EventEmitter } from 'events';
import { SimulatorBridge } from './SimulatorBridge.js';
import { LLMPlayer } from './LLMPlayer.js';
import { AdapterFactory } from '../llm/AdapterFactory.js';
import type { LLMConfig, LLMAdapter, LLMProvider, DialogueContext } from '../llm/types.js';
import { DialogueAdapter } from '../llm/DialogueAdapter.js';
import { config } from '../config.js';
import {
  emitBattleStarted,
  emitBattleUpdate,
  emitBattleThinking,
  emitBattleReasoning,
  emitBattleDecision,
  emitBattleEnd,
  emitBattleDialogue,
} from '../server/socket.js';
import { saveBattle } from '../db/client.js';

export interface BattleStatus {
  active: boolean;
  battleId?: string;
  turn?: number;
  p1?: { provider: string; model: string };
  p2?: { provider: string; model: string };
  winner?: string | null;
  spectatorCount?: number;
  battleLog?: string[];  // Protocol history for late joiners
}

class ActiveBattle extends EventEmitter {
  public battleId: string;
  public turn = 0;
  public winner: string | null = null;
  public startedAt: Date;
  private bridge: SimulatorBridge;
  private p1Adapter: LLMAdapter;
  private p2Adapter: LLMAdapter;
  private p1Player: LLMPlayer | null = null;
  private p2Player: LLMPlayer | null = null;
  private p1Config: LLMConfig;
  private p2Config: LLMConfig;
  private format: string;
  private battleLog: string[] = [];
  private p1Dialogue: DialogueAdapter;
  private p2Dialogue: DialogueAdapter;
  private lastTrashTalkTurn = 0;
  private lastMoveUser: 'p1' | 'p2' | null = null;

  constructor(
    battleId: string,
    p1Config: LLMConfig,
    p2Config: LLMConfig,
    format: string
  ) {
    super();
    this.battleId = battleId;
    this.p1Config = p1Config;
    this.p2Config = p2Config;
    this.format = format;
    this.startedAt = new Date();
    this.bridge = new SimulatorBridge();

    // Create adapters
    this.p1Adapter = AdapterFactory.create(p1Config);
    this.p2Adapter = AdapterFactory.create(p2Config);

    // Create dialogue adapters (fast models)
    this.p1Dialogue = new DialogueAdapter(p1Config.provider as LLMProvider);
    this.p2Dialogue = new DialogueAdapter(p2Config.provider as LLMProvider);
  }

  async start(): Promise<void> {
    console.log(`Starting battle: ${this.p1Config.provider}/${this.p1Config.model} vs ${this.p2Config.provider}/${this.p2Config.model}`);

    // Start the battle
    const streams = await this.bridge.startBattle({
      format: this.format,
      p1Name: `${this.p1Config.provider}/${this.p1Config.model}`,
      p2Name: `${this.p2Config.provider}/${this.p2Config.model}`,
    });

    // Create LLM players FIRST (they need to be ready before battle events flow)
    this.p1Player = new LLMPlayer(streams.p1, {
      adapter: this.p1Adapter,
      format: this.format,
      slot: 'p1',
      onThinking: () => {
        this.emit('thinking', 'p1');
        emitBattleThinking({
          battleId: this.battleId,
          player: 'p1',
          startTime: Date.now(),
        });
      },
      onReasoningChunk: (chunk) => {
        emitBattleReasoning({
          battleId: this.battleId,
          player: 'p1',
          chunk,
          done: false,
        });
      },
      onReasoningDone: () => {
        emitBattleReasoning({
          battleId: this.battleId,
          player: 'p1',
          chunk: '',
          done: true,
        });
      },
      onDecision: (choice, displayChoice, reasoning, time) => {
        this.turn = this.p1Player?.getTurn() || this.turn;
        this.emit('decision', { player: 'p1', choice, displayChoice, reasoning, time });
        emitBattleDecision({
          battleId: this.battleId,
          player: 'p1',
          choice,
          displayChoice,
          reasoning,
          time: time || 0,
        });
      },
    });

    this.p2Player = new LLMPlayer(streams.p2, {
      adapter: this.p2Adapter,
      format: this.format,
      slot: 'p2',
      onThinking: () => {
        this.emit('thinking', 'p2');
        emitBattleThinking({
          battleId: this.battleId,
          player: 'p2',
          startTime: Date.now(),
        });
      },
      onReasoningChunk: (chunk) => {
        emitBattleReasoning({
          battleId: this.battleId,
          player: 'p2',
          chunk,
          done: false,
        });
      },
      onReasoningDone: () => {
        emitBattleReasoning({
          battleId: this.battleId,
          player: 'p2',
          chunk: '',
          done: true,
        });
      },
      onDecision: (choice, displayChoice, reasoning, time) => {
        this.turn = Math.max(this.turn, this.p2Player?.getTurn() || 0);
        this.emit('decision', { player: 'p2', choice, displayChoice, reasoning, time });
        emitBattleDecision({
          battleId: this.battleId,
          player: 'p2',
          choice,
          displayChoice,
          reasoning,
          time: time || 0,
        });
      },
    });

    // Listen for battle updates (set up BEFORE waiting for initial state)
    this.bridge.on('update', (chunk: string) => {
      this.battleLog.push(chunk);
      this.emit('update', chunk);
      emitBattleUpdate({ battleId: this.battleId, chunk });

      // Log important battle events
      this.logBattleEvents(chunk);
    });

    this.bridge.on('end', (result: { winner: string | null }) => {
      this.winner = result.winner;
      this.emit('end', result);
      emitBattleEnd({
        battleId: this.battleId,
        winner: result.winner,
        p1: { provider: this.p1Config.provider, model: this.p1Config.model },
        p2: { provider: this.p2Config.provider, model: this.p2Config.model },
      });
    });

    // WAIT for initial battle state (switch events) before emitting started
    // This ensures frontend receives Pokemon data immediately
    const initialLog = await this.bridge.getInitialState();

    // NOW emit battle started with initial state
    emitBattleStarted({
      battleId: this.battleId,
      p1: { provider: this.p1Config.provider, model: this.p1Config.model },
      p2: { provider: this.p2Config.provider, model: this.p2Config.model },
      format: this.format,
      initialLog,
    });

    // Generate battle start dialogue for both players
    this.generateDialogue('p1', {
      type: 'battle_start',
      opponent: { provider: this.p2Config.provider, model: this.p2Config.model },
      turn: 0,
    });
    this.generateDialogue('p2', {
      type: 'battle_start',
      opponent: { provider: this.p1Config.provider, model: this.p1Config.model },
      turn: 0,
    });

    // Start both players (they will listen for requests)
    void this.p1Player.start();
    void this.p2Player.start();
  }

  private async generateDialogue(player: 'p1' | 'p2', context: DialogueContext): Promise<void> {
    const adapter = player === 'p1' ? this.p1Dialogue : this.p2Dialogue;
    try {
      const text = await adapter.generateDialogue(context);
      if (text) {
        emitBattleDialogue({
          battleId: this.battleId,
          player,
          text,
          eventType: context.type,
        });
      }
    } catch (error) {
      console.error(`[Dialogue] Error generating ${context.type} for ${player}:`, error);
    }
  }

  private logBattleEvents(chunk: string): void {
    const lines = chunk.split('\n');
    let lastMoveName: string | null = null;

    for (const line of lines) {
      // Turn marker
      if (line.startsWith('|turn|')) {
        const turnNum = parseInt(line.split('|')[2], 10);
        this.turn = turnNum;
        console.log(`\n${'='.repeat(50)}`);
        console.log(`  TURN ${turnNum}`);
        console.log(`${'='.repeat(50)}`);

        // Random trash talk (20% chance, min 3 turns apart)
        if (turnNum - this.lastTrashTalkTurn >= 3 && Math.random() < 0.2) {
          this.lastTrashTalkTurn = turnNum;
          const trasher = Math.random() < 0.5 ? 'p1' : 'p2';
          const opponent = trasher === 'p1' ? this.p2Config : this.p1Config;
          this.generateDialogue(trasher, {
            type: 'trash_talk',
            opponent: { provider: opponent.provider, model: opponent.model },
            turn: turnNum,
          });
        }
      }
      // Pokemon switch
      else if (line.startsWith('|switch|') || line.startsWith('|drag|')) {
        const parts = line.split('|');
        const pokemon = parts[2];
        const details = parts[3];
        const hp = parts[4];
        console.log(`  🔄 ${pokemon} sent out! (${details}) [${hp}]`);
      }
      // Move used - track who used it
      else if (line.startsWith('|move|')) {
        const parts = line.split('|');
        const attacker = parts[2];
        const move = parts[3];
        const target = parts[4] || '';
        lastMoveName = move;
        this.lastMoveUser = attacker.startsWith('p1') ? 'p1' : 'p2';
        console.log(`  ⚔️  ${attacker} used ${move}${target ? ` on ${target}` : ''}`);
      }
      // Damage
      else if (line.startsWith('|-damage|')) {
        const parts = line.split('|');
        const pokemon = parts[2];
        const hp = parts[3];
        const source = parts[4] || '';
        console.log(`  💥 ${pokemon} took damage! HP: ${hp}${source ? ` (${source})` : ''}`);
      }
      // Heal
      else if (line.startsWith('|-heal|')) {
        const parts = line.split('|');
        const pokemon = parts[2];
        const hp = parts[3];
        console.log(`  💚 ${pokemon} healed! HP: ${hp}`);
      }
      // Faint
      else if (line.startsWith('|faint|')) {
        const pokemon = line.split('|')[2];
        const faintedSide = pokemon.startsWith('p1') ? 'p1' : 'p2';
        const pokemonName = pokemon.split(':')[1]?.trim() || 'Pokemon';
        console.log(`  ☠️  ${pokemon} fainted!`);

        // Own faint for the player who lost, opponent faint for the other
        const opponent = faintedSide === 'p1' ? this.p2Config : this.p1Config;
        this.generateDialogue(faintedSide, {
          type: 'own_faint',
          opponent: { provider: opponent.provider, model: opponent.model },
          ownPokemon: pokemonName,
          turn: this.turn,
        });

        const winnerSide = faintedSide === 'p1' ? 'p2' : 'p1';
        const winnerOpponent = winnerSide === 'p1' ? this.p2Config : this.p1Config;
        this.generateDialogue(winnerSide, {
          type: 'opponent_faint',
          opponent: { provider: winnerOpponent.provider, model: winnerOpponent.model },
          opponentPokemon: pokemonName,
          turn: this.turn,
        });
      }
      // Super effective
      else if (line.startsWith('|-supereffective|')) {
        console.log(`  ✨ It's super effective!`);
        if (this.lastMoveUser) {
          const opponent = this.lastMoveUser === 'p1' ? this.p2Config : this.p1Config;
          this.generateDialogue(this.lastMoveUser, {
            type: 'super_effective',
            opponent: { provider: opponent.provider, model: opponent.model },
            moveName: lastMoveName || 'attack',
            turn: this.turn,
          });
        }
      }
      // Not very effective
      else if (line.startsWith('|-resisted|')) {
        console.log(`  🛡️  It's not very effective...`);
      }
      // Critical hit
      else if (line.startsWith('|-crit|')) {
        console.log(`  💢 Critical hit!`);
        if (this.lastMoveUser) {
          const opponent = this.lastMoveUser === 'p1' ? this.p2Config : this.p1Config;
          this.generateDialogue(this.lastMoveUser, {
            type: 'critical_hit',
            opponent: { provider: opponent.provider, model: opponent.model },
            turn: this.turn,
          });
        }
      }
      // Miss
      else if (line.startsWith('|-miss|')) {
        const attacker = line.split('|')[2];
        console.log(`  ❌ ${attacker}'s attack missed!`);
      }
      // Immune
      else if (line.startsWith('|-immune|')) {
        const pokemon = line.split('|')[2];
        console.log(`  🚫 ${pokemon} is immune!`);
      }
      // Status
      else if (line.startsWith('|-status|')) {
        const parts = line.split('|');
        const pokemon = parts[2];
        const status = parts[3];
        console.log(`  🔮 ${pokemon} was ${status === 'brn' ? 'burned' : status === 'par' ? 'paralyzed' : status === 'psn' ? 'poisoned' : status === 'tox' ? 'badly poisoned' : status === 'slp' ? 'put to sleep' : status === 'frz' ? 'frozen' : status}!`);
      }
      // Boost
      else if (line.startsWith('|-boost|')) {
        const parts = line.split('|');
        const pokemon = parts[2];
        const stat = parts[3];
        const amount = parts[4];
        console.log(`  ⬆️  ${pokemon}'s ${stat} rose${amount === '2' ? ' sharply' : amount === '3' ? ' drastically' : ''}!`);
      }
      // Unboost
      else if (line.startsWith('|-unboost|')) {
        const parts = line.split('|');
        const pokemon = parts[2];
        const stat = parts[3];
        const amount = parts[4];
        console.log(`  ⬇️  ${pokemon}'s ${stat} fell${amount === '2' ? ' harshly' : amount === '3' ? ' severely' : ''}!`);
      }
      // Weather
      else if (line.startsWith('|-weather|')) {
        const weather = line.split('|')[2];
        if (weather !== 'none') {
          console.log(`  🌤️  Weather: ${weather}`);
        }
      }
      // Winner
      else if (line.startsWith('|win|')) {
        const winner = line.split('|')[2];
        console.log(`\n${'🏆'.repeat(10)}`);
        console.log(`  WINNER: ${winner}`);
        console.log(`${'🏆'.repeat(10)}\n`);

        // Determine winner/loser sides
        const p1Won = winner.includes(this.p1Config.provider);
        this.generateDialogue('p1', {
          type: p1Won ? 'win' : 'loss',
          opponent: { provider: this.p2Config.provider, model: this.p2Config.model },
          turn: this.turn,
        });
        this.generateDialogue('p2', {
          type: p1Won ? 'loss' : 'win',
          opponent: { provider: this.p1Config.provider, model: this.p1Config.model },
          turn: this.turn,
        });
      }
    }
  }

  getLog(): string[] {
    return this.battleLog;
  }

  async forceEnd(): Promise<void> {
    await this.bridge.forceEnd();
    this.cleanup();
  }

  private cleanup(): void {
    this.p1Adapter.destroy();
    this.p2Adapter.destroy();
    this.p1Dialogue.destroy();
    this.p2Dialogue.destroy();
    this.bridge.destroy();
  }

  isEnded(): boolean {
    return this.bridge.ended;
  }

  getStatus(): BattleStatus {
    return {
      active: !this.isEnded(),
      battleId: this.battleId,
      turn: this.turn,
      p1: { provider: this.p1Config.provider, model: this.p1Config.model },
      p2: { provider: this.p2Config.provider, model: this.p2Config.model },
      winner: this.winner,
      battleLog: this.battleLog,  // Include protocol history for late joiners
    };
  }
}

class BattleManager {
  private activeBattle: ActiveBattle | null = null;

  async startBattle(
    p1: LLMConfig,
    p2: LLMConfig,
    format?: string
  ): Promise<string> {
    if (this.activeBattle && !this.activeBattle.isEnded()) {
      throw new Error('Battle already in progress');
    }

    const battleId = `battle-${Date.now()}`;
    const battleFormat = format || config.battle.format;

    this.activeBattle = new ActiveBattle(battleId, p1, p2, battleFormat);

    // Listen for battle end to save and clean up
    this.activeBattle.on('end', async (result: { winner: string | null }) => {
      console.log(`Battle ${battleId} ended`);

      // Determine winner side and details
      let winnerSide: string | null = null;
      let winnerProvider: string | null = null;
      let winnerModel: string | null = null;

      if (result.winner) {
        // Winner string contains the player name like "claude/claude-sonnet-4-20250514"
        if (result.winner.includes(p1.provider)) {
          winnerSide = 'p1';
          winnerProvider = p1.provider;
          winnerModel = p1.model;
        } else {
          winnerSide = 'p2';
          winnerProvider = p2.provider;
          winnerModel = p2.model;
        }
      }

      // Save to database
      try {
        await saveBattle({
          battle_id: battleId,
          format: battleFormat,
          p1_provider: p1.provider,
          p1_model: p1.model,
          p2_provider: p2.provider,
          p2_model: p2.model,
          winner_side: winnerSide,
          winner_provider: winnerProvider,
          winner_model: winnerModel,
          total_turns: this.activeBattle?.turn || 0,
          started_at: this.activeBattle?.startedAt || new Date(),
          ended_at: new Date(),
          battle_log: this.activeBattle?.getLog() || [],
        });
        console.log(`Battle ${battleId} saved to database`);
      } catch (error) {
        console.error(`Failed to save battle ${battleId}:`, error);
      }
    });

    // Start the battle
    await this.activeBattle.start();

    return battleId;
  }

  getStatus(): BattleStatus {
    if (!this.activeBattle) {
      return { active: false };
    }
    return this.activeBattle.getStatus();
  }

  getCurrentBattle(): ActiveBattle | null {
    return this.activeBattle;
  }
}

export const battleManager = new BattleManager();
