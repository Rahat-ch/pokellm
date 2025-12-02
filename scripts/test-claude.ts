/**
 * Test script to verify Claude adapter works
 * Run with: npm run test:claude
 *
 * Make sure ANTHROPIC_API_KEY is set in your .env file
 */

import 'dotenv/config';
import { ClaudeAdapter } from '../src/llm/adapters/ClaudeAdapter.js';
import type { BattleContext } from '../src/llm/types.js';

// Sample battle request (simulating what pokemon-showdown sends)
const sampleRequest = {
  active: [{
    moves: [
      { move: 'Thunderbolt', id: 'thunderbolt', pp: 15, maxpp: 15, target: 'normal', disabled: false },
      { move: 'Quick Attack', id: 'quickattack', pp: 30, maxpp: 30, target: 'normal', disabled: false },
      { move: 'Iron Tail', id: 'irontail', pp: 15, maxpp: 15, target: 'normal', disabled: false },
      { move: 'Volt Switch', id: 'voltswitch', pp: 20, maxpp: 20, target: 'normal', disabled: false },
    ],
    canMegaEvo: false,
    trapped: false,
  }],
  side: {
    name: 'TestPlayer',
    id: 'p1',
    pokemon: [
      {
        ident: 'p1: Pikachu',
        details: 'Pikachu, L84, M',
        condition: '215/215',
        active: true,
        stats: { atk: 130, def: 110, spa: 135, spd: 130, spe: 200 },
        moves: ['thunderbolt', 'quickattack', 'irontail', 'voltswitch'],
        baseAbility: 'static',
        item: 'lightball',
      },
      {
        ident: 'p1: Charizard',
        details: 'Charizard, L78, M',
        condition: '266/266',
        active: false,
        stats: { atk: 150, def: 140, spa: 195, spd: 155, spe: 180 },
        moves: ['flamethrower', 'airslash', 'dragonpulse', 'roost'],
        baseAbility: 'blaze',
        item: 'choicespecs',
      },
      {
        ident: 'p1: Blastoise',
        details: 'Blastoise, L82, M',
        condition: '268/268',
        active: false,
        stats: { atk: 148, def: 180, spa: 155, spd: 185, spe: 140 },
        moves: ['hydropump', 'icebeam', 'rapidspin', 'toxic'],
        baseAbility: 'torrent',
        item: 'leftovers',
      },
    ],
  },
};

async function main() {
  console.log('Testing Claude Adapter...\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY is not set!');
    console.log('Please add your Anthropic API key to the .env file');
    process.exit(1);
  }

  // Create adapter
  const adapter = new ClaudeAdapter('claude-sonnet-4-20250514', 0.7);
  console.log(`Created adapter for model: ${adapter.model}`);

  // Create battle context
  const context: BattleContext = {
    turn: 3,
    request: sampleRequest,
    battleLog: [
      '|move|p2a: Garchomp|Earthquake|p1a: Pikachu',
      '|-damage|p1a: Pikachu|65/100',
      '|move|p1a: Pikachu|Thunderbolt|p2a: Garchomp',
      '|-immune|p2a: Garchomp',
    ],
    format: 'gen9randombattle',
  };

  console.log('\nSending battle context to Claude...');
  const startTime = Date.now();

  try {
    const response = await adapter.decide(context);
    const elapsed = Date.now() - startTime;

    console.log(`\n✅ Response received in ${elapsed}ms`);
    console.log(`\nLLM Response: "${response.text}"`);
    if (response.reasoning) {
      console.log(`Reasoning: ${response.reasoning}`);
    }
    console.log(`Tokens used: ${response.tokensUsed}`);

    // Validate the response
    const validCommands = ['move 1', 'move 2', 'move 3', 'move 4', 'switch 2', 'switch 3'];
    const isValid = validCommands.some(cmd =>
      response.text.toLowerCase().includes(cmd)
    );

    if (isValid) {
      console.log('\n✅ Response is a valid move command!');
    } else {
      console.log('\n⚠️ Response may not be a valid command format');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }

  adapter.destroy();
  console.log('\n✅ Claude adapter test completed!');
}

main().catch(console.error);
