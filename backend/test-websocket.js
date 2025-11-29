// Simple WebSocket test script
import WebSocket from 'ws';

const token = process.argv[2] || 'test-token';
const requestId = process.argv[3] || 'test-request-id';

const ws = new WebSocket(`ws://localhost:3001/ai/stream/${requestId}?token=${token}`);

ws.on('open', () => {
  console.log('✅ WebSocket connected');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📨 Received:', message.type, message.data);
  } catch (e) {
    console.log('📨 Received (raw):', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 WebSocket closed: ${code} - ${reason.toString()}`);
});

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 10000);

