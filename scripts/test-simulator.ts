/**
 * Test script to verify the Pokemon Showdown simulator works
 * Run with: npm run test:simulator
 */

import { createRequire } from 'module';

// Use createRequire to import CommonJS module properly
const require = createRequire(import.meta.url);
const Sim = require('pokemon-showdown');
const { BattleStream, getPlayerStreams, Teams } = Sim;

class RandomPlayer {
  private stream: any;
  private slot: string;

  constructor(stream: any, slot: string) {
    this.stream = stream;
    this.slot = slot;
  }

  async start() {
    for await (const chunk of this.stream) {
      this.receive(chunk);
    }
  }

  receive(chunk: string) {
    for (const line of chunk.split('\n')) {
      if (line.startsWith('|request|')) {
        const request = JSON.parse(line.slice(9));
        this.handleRequest(request);
      }
    }
  }

  handleRequest(request: any) {
    if (request.wait) return;

    let choice: string;

    if (request.teamPreview) {
      choice = 'default';
    } else if (request.forceSwitch) {
      // Find a valid switch
      const pokemon = request.side.pokemon;
      for (let i = 1; i < pokemon.length; i++) {
        if (!pokemon[i].condition.endsWith(' fnt')) {
          choice = `switch ${i + 1}`;
          break;
        }
      }
      choice = choice! || 'pass';
    } else if (request.active) {
      // Pick a random valid move
      const moves = request.active[0].moves;
      const validMoves = moves
        .map((m: any, i: number) => ({ move: m, index: i + 1 }))
        .filter((m: any) => !m.move.disabled);

      if (validMoves.length > 0) {
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        choice = `move ${randomMove.index}`;
      } else {
        choice = 'pass';
      }
    } else {
      choice = 'pass';
    }

    console.log(`[${this.slot}] Choosing: ${choice}`);
    this.stream.write(choice);
  }
}

async function main() {
  console.log('Testing Pokemon Showdown Simulator...\n');

  const battleStream = new BattleStream();
  const streams = getPlayerStreams(battleStream);

  // Generate random teams
  const format = 'gen9randombattle';
  const p1Team = Teams.pack(Teams.generate(format));
  const p2Team = Teams.pack(Teams.generate(format));

  console.log('Generated random teams for both players');

  // Create random players
  const p1 = new RandomPlayer(streams.p1, 'p1');
  const p2 = new RandomPlayer(streams.p2, 'p2');

  // Start listening for battle output
  let turnCount = 0;
  const outputPromise = (async () => {
    for await (const chunk of streams.omniscient) {
      // Count turns
      if (chunk.includes('|turn|')) {
        turnCount++;
        console.log(`\n--- Turn ${turnCount} ---`);
      }

      // Check for winner
      const winMatch = chunk.match(/\|win\|(.+)/);
      if (winMatch) {
        console.log(`\n🏆 Winner: ${winMatch[1]}`);
        console.log(`Battle completed in ${turnCount} turns`);
      }

      // Log key events
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('|move|') ||
            line.startsWith('|switch|') ||
            line.startsWith('|faint|') ||
            line.startsWith('|-damage|')) {
          console.log(line);
        }
      }
    }
  })();

  // Start the battle
  const startCommand = `>start ${JSON.stringify({ formatid: format })}
>player p1 ${JSON.stringify({ name: 'Bot 1', team: p1Team })}
>player p2 ${JSON.stringify({ name: 'Bot 2', team: p2Team })}`;

  console.log('Starting battle...\n');
  await streams.omniscient.write(startCommand);

  // Start both players
  void p1.start();
  void p2.start();

  // Wait for battle to complete
  await outputPromise;

  console.log('\n✅ Simulator test completed successfully!');
}

main().catch(console.error);
