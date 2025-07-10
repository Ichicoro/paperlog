import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import vite from '@fastify/vite';
import { Database } from 'bun:sqlite';
import type { WebSocket } from 'ws';

console.log("Hello via Bun with Fastify!");

// Create Fastify instance
const fastify = Fastify({
  logger: true
});

// Register plugins
await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

await fastify.register(websocket);

// Register Vite with simplified HMR support
try {
  await fastify.register(vite, {
    clientModule: 'src/main.ts',
    root: import.meta.dirname,
    dev: true,
    spa: true,
  });
  console.log('Fastify server configured with Vite HMR');
} catch (error) {
  console.error('Error registering Vite:', error);
  // Fallback without Vite
  console.log('Fastify server configured without Vite');
}

// Initialize the SQLite database
const db = new Database('data.db');
// Create a table if it doesn't exist
db.run(`
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`)

// Store WebSocket connections
const wsConnections = new Set<WebSocket>();

const addEntry = (text: string) => {
  const created_at = new Date().getTime();
  // Insert the entry into the database
  const changes = db.run('INSERT INTO entries (text, created_at) VALUES (?, ?)', [text, created_at]);
  const id = changes.lastInsertRowid;
  // Log the received data
  console.log('Entry added:', { id, text, created_at });
  // Broadcast to WebSocket clients
  const message = JSON.stringify({ id, text, created_at });
  wsConnections.forEach((connection) => {
    try {
      connection.send(message);
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      wsConnections.delete(connection);
    }
  });
  return { id, text, created_at }
};


// WebSocket route
fastify.get('/api/ws', { websocket: true }, (connection) => {
  console.log('WebSocket connection established');
  wsConnections.add(connection);

  connection.on('message', (message) => {
    console.log('Received message:', message.toString());
    // Echo the message back to the client
    connection.send(JSON.stringify({ message: `You sent: ${message}` }));
  });

  connection.on('close', () => {
    console.log('WebSocket connection closed');
    wsConnections.delete(connection);
  });
});

// API routes
fastify.get('/api/hello', async () => {
  return { message: 'Hello from Receipt!' };
});

fastify.get('/api/entries', async () => {
  // Fetch all entries from the database
  let entries = db.query('SELECT * FROM entries ORDER BY created_at DESC').all() as { created_at: number }[];
  entries = entries.map(entry => ({ ...entry, created_at: new Date(entry.created_at).getTime() }));
  console.log(entries);
  return entries;
});

fastify.get('/api/addEntry', async (request, reply) => {
  const { text } = request.query as { text?: string };
  if (!text) {
    reply.code(400);
    return { error: 'Bad Request: Missing text parameter' };
  }
  const entryData = addEntry(text);
  reply.code(201);
  return entryData;
});

fastify.post('/api/addEntry', async (request, reply) => {
  const data = request.body as { text?: string };
  if (!data.text) {
    reply.code(400);
    return { error: 'Bad Request: Missing text field' };
  }
  const entryData = addEntry(data.text);
  reply.code(201);
  return entryData;
});

// Serve Vite app for all non-API routes (SPA fallback)
fastify.get('/*', async (request, reply) => {
  return reply.html();
});

// Catch-all route for SPA routing (must be last)
fastify.setNotFoundHandler(async (request, reply) => {
  // Only serve HTML for non-API routes
  if (!request.url.startsWith('/api/')) {
    return reply.render();
  }
  reply.code(404);
  return { error: 'API endpoint not found' };
});

// Start the server
const start = async () => {
  try {
    await fastify.vite.ready();
    await fastify.listen({ port: 3123, host: '0.0.0.0' });
    console.log('Server listening on http://localhost:3123');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();