import { beforeRequest, useMiddleware } from 'bun-serve-route-plus';
import { Database } from 'bun:sqlite';
// import webapp from "./build/index.html";
console.log("Hello via Bun!");

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

const addEntry = (text: string, server?: Bun.Server) => {
  const created_at = new Date().getTime();
  // Insert the entry into the database
  const changes = db.run('INSERT INTO entries (text, created_at) VALUES (?, ?)', [text, created_at]);
  const id = changes.lastInsertRowid;
  // Log the received data
  console.log('Entry added:', { id, text, created_at });
  // console.log("timestamp:", timestamp)
  if (server) {
    server.publish("newEntry", JSON.stringify({ id, text, created_at }));
  }
  return { id, text, created_at }
};


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
beforeRequest.use((req: Request, server: Bun.Server) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
});

const server = Bun.serve({
  development: true,
  port: "3123",
  routes: useMiddleware({
    '/api/ws': async (req, server) => {
      const upgraded = server.upgrade(req)
      if (upgraded) {
        console.log('WebSocket connection established');
      } else {
        console.error('Failed to upgrade to WebSocket');
      }
      return new Response(null, { status: 201 });
    },
    '/api/hello': () => new Response('Hello from Receipt!', { headers: corsHeaders }),
    '/api/entries': () => {
      // Fetch all entries from the database
      let entries = db.query('SELECT * FROM entries ORDER BY created_at DESC').all() as { created_at: number }[];
      entries = entries.map(entry => ({ ...entry, created_at: new Date(entry.created_at).getTime() }));
      console.log(entries);
      // Return the entries as JSON
      return new Response(JSON.stringify(entries), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    },
    '/api/addEntry': {
      GET: async (req: Request) => {
        // Get param text from the URL
        const url = new URL(req.url);
        const inputText = url.searchParams.get('text');
        if (!inputText) {
          return new Response('Bad Request: Missing text parameter', { status: 400 });
        }
        const entryData = addEntry(inputText, server);
        // trigger a WebSocket message to all connected clients
        // server.publish("newEntry", JSON.stringify({ text, timestamp }));
        return Response.json(entryData, { status: 201, headers: corsHeaders });
      },

      POST: async (req: Request) => {
        let data: { text: string };
        try {
          data = await req.json();
        } catch (error) {
          console.error('Error parsing JSON:', error.toString());
          return new Response('Bad Request: Invalid JSON', { status: 400 });
        }
        if (!data.text) {
          return new Response('Bad Request: Missing text field', { status: 400 });
        }
        const entryData = addEntry(data.text, server);
        // trigger a WebSocket message to all connected clients
        // server.publish("newEntry", JSON.stringify({ text, timestamp }));
        return Response.json(entryData, { status: 201, headers: corsHeaders });
      }
    },
    // '/': webapp,
  }),
  websocket: {
    message(ws, message) {
      console.log('Received message:', message);
      // Echo the message back to the client
      ws.send(`{ "message": "You sent: ${message}" }`);
    },
    open(ws) {
      console.log('WebSocket connection opened');
      // ws.send('Welcome to the WebSocket server!');
      ws.subscribe("newEntry");
    },
    close(ws) {
      console.log('WebSocket connection closed');
      ws.unsubscribe("newEntry");
    }
  }
})