/**
 * Test script for Phase 1 - WebSocket Integration
 *
 * Run: npx tsx scripts/test-socket.ts
 *
 * This script:
 * 1. Connects to the server via Socket.io
 * 2. Listens for battle events
 * 3. Starts a battle via REST API
 * 4. Logs all received socket events
 */

import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

async function main() {
  console.log('🔌 Connecting to server...');

  const socket = io(SERVER_URL);

  socket.on('connect', () => {
    console.log('✅ Connected to server!');
    console.log(`   Socket ID: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
  });

  // Listen for battle events
  socket.on('battle:status', (data) => {
    console.log('\n📊 [battle:status]', JSON.stringify(data, null, 2));
  });

  socket.on('battle:started', (data) => {
    console.log('\n🎮 [battle:started]', JSON.stringify(data, null, 2));
  });

  socket.on('battle:thinking', (data) => {
    console.log(`\n🤔 [battle:thinking] ${data.player} is thinking...`);
  });

  socket.on('battle:decision', (data) => {
    console.log(`\n✅ [battle:decision] ${data.player}: ${data.choice} (${data.time}ms)`);
    if (data.reasoning) {
      console.log(`   Reasoning: ${data.reasoning.substring(0, 100)}...`);
    }
  });

  socket.on('battle:update', (data) => {
    // Only log important updates (not every chunk)
    const chunk = data.chunk;
    if (chunk.includes('|turn|') || chunk.includes('|win|') || chunk.includes('|faint|')) {
      console.log(`\n⚔️ [battle:update]`);
      chunk.split('\n').forEach((line: string) => {
        if (line.trim()) console.log(`   ${line}`);
      });
    }
  });

  socket.on('battle:end', (data) => {
    console.log('\n🏆 [battle:end]', JSON.stringify(data, null, 2));
    console.log('\n✨ Test complete! Press Ctrl+C to exit.');
  });

  // Wait for connection then show instructions
  await new Promise<void>((resolve) => {
    socket.on('connect', resolve);
    setTimeout(resolve, 2000); // Timeout after 2s
  });

  console.log('\n📝 Instructions:');
  console.log('   1. The socket is now connected and listening');
  console.log('   2. Start a battle via REST API or another terminal:');
  console.log('');
  console.log('   curl -X POST http://localhost:3000/api/battle/start \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"p1": {"provider": "claude", "model": "claude-sonnet-4-20250514"}, "p2": {"provider": "claude", "model": "claude-sonnet-4-20250514"}}\'');
  console.log('');
  console.log('   3. Watch for socket events below...\n');

  // Keep the script running
  process.on('SIGINT', () => {
    console.log('\n👋 Disconnecting...');
    socket.disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
