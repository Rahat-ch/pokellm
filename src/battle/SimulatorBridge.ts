import { createRequire } from 'module';
import { EventEmitter } from 'events';

// Use createRequire to import CommonJS module properly
const require = createRequire(import.meta.url);
const Sim = require('pokemon-showdown');
const { BattleStream, getPlayerStreams, Teams } = Sim;

export interface BattleStartConfig {
  format: string;
  p1Name: string;
  p2Name: string;
}

export interface PlayerStreams {
  omniscient: any;
  spectator: any;
  p1: any;
  p2: any;
}

/**
 * SimulatorBridge wraps the Pokemon Showdown BattleStream
 * and provides a cleaner interface for running battles.
 */
export class SimulatorBridge extends EventEmitter {
  private battleStream: InstanceType<typeof BattleStream> | null = null;
  private streams: PlayerStreams | null = null;
  private battleLog: string[] = [];
  private _ended = false;

  // Initial state tracking - resolves when first switch events arrive
  private initialStateReady!: Promise<string[]>;
  private resolveInitialState!: (chunks: string[]) => void;
  private initialChunks: string[] = [];
  private initialStateResolved = false;

  get ended() {
    return this._ended;
  }

  /**
   * Initialize a new battle with random teams
   */
  async startBattle(battleConfig: BattleStartConfig): Promise<PlayerStreams> {
    this.battleStream = new BattleStream();
    this.streams = getPlayerStreams(this.battleStream) as PlayerStreams;
    this.battleLog = [];
    this._ended = false;

    // Reset initial state tracking
    this.initialChunks = [];
    this.initialStateResolved = false;
    this.initialStateReady = new Promise((resolve) => {
      this.resolveInitialState = resolve;
    });

    // Generate random teams
    const p1Team = Teams.pack(Teams.generate(battleConfig.format));
    const p2Team = Teams.pack(Teams.generate(battleConfig.format));

    // Listen to omniscient stream for logging and events
    this.listenToStream();

    // Start the battle
    const startCommand = `>start ${JSON.stringify({ formatid: battleConfig.format })}
>player p1 ${JSON.stringify({ name: battleConfig.p1Name, team: p1Team })}
>player p2 ${JSON.stringify({ name: battleConfig.p2Name, team: p2Team })}`;

    await this.streams.omniscient.write(startCommand);

    return this.streams;
  }

  private async listenToStream() {
    if (!this.streams) return;

    try {
      for await (const chunk of this.streams.omniscient) {
        this.battleLog.push(chunk);
        this.emit('update', chunk);

        // Collect initial chunks until we see switch events (Pokemon appearing)
        if (!this.initialStateResolved) {
          this.initialChunks.push(chunk);
          // Switch events indicate Pokemon have entered the battle
          if (chunk.includes('|switch|') || chunk.includes('|turn|')) {
            this.initialStateResolved = true;
            this.resolveInitialState(this.initialChunks);
          }
        }

        // Check for battle end
        if (chunk.includes('|win|') || chunk.includes('|tie|')) {
          this._ended = true;
          this.emit('end', this.parseWinner(chunk));
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  private parseWinner(chunk: string): { winner: string | null } {
    const winMatch = chunk.match(/\|win\|(.+)/);
    if (winMatch) {
      return { winner: winMatch[1] };
    }
    return { winner: null }; // tie
  }

  getLog(): string[] {
    return this.battleLog;
  }

  /**
   * Wait for initial battle state (switch events) to be ready
   * This allows callers to wait until Pokemon have entered the battle
   */
  async getInitialState(): Promise<string[]> {
    return this.initialStateReady;
  }

  getStreams(): PlayerStreams | null {
    return this.streams;
  }

  /**
   * Force end the battle
   */
  async forceEnd() {
    if (this.streams) {
      await this.streams.omniscient.write('>forcetie');
    }
    this._ended = true;
  }

  destroy() {
    this.battleStream = null;
    this.streams = null;
    this._ended = true;
  }
}
