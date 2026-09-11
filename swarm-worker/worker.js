/* MAGGOTS · presence server ("the brood").
   Cloudflare Worker + one Durable Object. Every open tab connects over WebSocket,
   says who it is (an id, optionally a wallet), and the room broadcasts the roster
   every second. Close the tab and the socket drops and the maggot pupates.

   Deploy:  npm i -g wrangler ; wrangler login ; wrangler deploy   (from this folder)
   Then set CONFIG.swarmUrl = 'wss://<your-worker>.workers.dev/room' in site/app.js. */

export class Room {
  constructor(state, env) { this.state = state; this.peers = new Map(); this.timer = null; }
  fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response(JSON.stringify({ alive: this.peers.size }), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    server.accept();
    const id = crypto.randomUUID().slice(0, 8);
    const peer = { id, name: 'anon_' + id.slice(0, 4), wallet: null, size: 1, born: Date.now(), ws: server };
    this.peers.set(id, peer);
    server.addEventListener('message', ev => {
      try { const m = JSON.parse(ev.data); if (m.name) peer.name = String(m.name).slice(0, 24); if (m.wallet) peer.wallet = String(m.wallet).slice(0, 42); if (typeof m.size === 'number') peer.size = Math.max(0.5, Math.min(4, m.size)); } catch (e) { }
    });
    const drop = () => { this.peers.delete(id); this.broadcast(); };
    server.addEventListener('close', drop); server.addEventListener('error', drop);
    server.send(JSON.stringify({ you: id }));
    this.broadcast();
    if (!this.timer) this.timer = setInterval(() => this.broadcast(), 1000);
    return new Response(null, { status: 101, webSocket: client });
  }
  broadcast() {
    const roster = [...this.peers.values()].map(p => ({ id: p.id, name: p.name, size: p.size, born: p.born, wallet: p.wallet ? p.wallet.slice(0, 6) + '…' + p.wallet.slice(-4) : null }));
    const msg = JSON.stringify({ roster, t: Date.now() });
    for (const p of this.peers.values()) { try { p.ws.send(msg); } catch (e) { this.peers.delete(p.id); } }
    if (!this.peers.size && this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/room')) { const id = env.ROOM.idFromName('plate-001'); return env.ROOM.get(id).fetch(req); }
    return new Response('maggots presence. connect a websocket to /room', { headers: { 'access-control-allow-origin': '*' } });
  }
};
