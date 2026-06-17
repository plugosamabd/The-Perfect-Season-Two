import Peer, { type DataConnection } from "peerjs";

export type MessageType =
  | "sync-room"
  | "chat"
  | "spin"
  | "pick"
  | "start-game"
  | "reset-room"
  | "request-sync"
  | "hello";

export interface P2PMessage {
  type: MessageType;
  data: unknown;
  timestamp: number;
  senderId: string;
}

type Handler = (data: unknown, senderId: string) => void;

const log = (...args: unknown[]) => console.log("[P2P]", ...args);
const warn = (...args: unknown[]) => console.warn("[P2P]", ...args);
const err = (...args: unknown[]) => console.error("[P2P]", ...args);

// Deterministic peer-id from room code so joiners can dial the host directly.
export function hostPeerId(roomCode: string): string {
  return `eightytwozero-${roomCode.toLowerCase()}`;
}

class PeerManager {
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  private handlers = new Map<MessageType, Handler>();
  public selfId = "";
  public isHost = false;
  private connStateListeners = new Set<(connected: boolean) => void>();
  private newPeerListeners = new Set<(peerId: string) => void>();

  async initHost(roomCode: string): Promise<string> {
    await this.destroy();
    this.isHost = true;
    const id = hostPeerId(roomCode);
    log(`initHost — claiming peer ID "${id}"`);
    return this.bootPeer(id);
  }

  async initJoiner(): Promise<string> {
    await this.destroy();
    this.isHost = false;
    log("initJoiner — requesting random peer ID from broker");
    return this.bootPeer(undefined);
  }

  private bootPeer(id: string | undefined): Promise<string> {
    return new Promise((resolve, reject) => {
      const peer = id ? new Peer(id) : new Peer();
      this.peer = peer;
      log(`bootPeer — connecting to PeerJS broker${id ? ` as "${id}"` : " (random ID)"}`);
      const timer = setTimeout(() => {
        err("bootPeer — broker connection timed out after 12s");
        reject(new Error("PeerJS connect timeout"));
      }, 12_000);
      peer.on("open", (openId) => {
        clearTimeout(timer);
        this.selfId = openId;
        log(`bootPeer — broker open, self ID = "${openId}"`);
        peer.on("connection", (c) => {
          log(`incoming connection from peer "${c.peer}"`);
          this.wireConnection(c);
        });
        resolve(openId);
      });
      peer.on("error", (e) => {
        clearTimeout(timer);
        const msg = (e as { type?: string; message?: string }).message ?? String(e);
        const type = (e as { type?: string }).type ?? "unknown";
        err(`bootPeer error — type="${type}" msg="${msg}"`);
        reject(new Error(msg));
      });
      peer.on("disconnected", () => warn("broker disconnected (signaling server lost)"));
      peer.on("close", () => warn("peer closed"));
    });
  }

  async connectToHost(roomCode: string): Promise<void> {
    if (!this.peer) throw new Error("Peer not initialised");
    const target = hostPeerId(roomCode);
    log(`connectToHost — dialing "${target}"`);
    return new Promise((resolve, reject) => {
      const conn = this.peer!.connect(target, { reliable: true });
      const timer = setTimeout(() => {
        err(`connectToHost — no response from "${target}" after 20s`);
        reject(new Error("Host did not respond"));
      }, 20_000);
      conn.on("open", () => {
        clearTimeout(timer);
        log(`connectToHost — DataChannel open to "${target}"`);
        this.wireConnection(conn);
        resolve();
      });
      conn.on("error", (e) => {
        clearTimeout(timer);
        err(`connectToHost error connecting to "${target}":`, e);
        reject(e);
      });
    });
  }

  onNewPeer(cb: (peerId: string) => void): () => void {
    this.newPeerListeners.add(cb);
    return () => this.newPeerListeners.delete(cb);
  }

  private emitNewPeer(peerId: string) {
    for (const cb of this.newPeerListeners) cb(peerId);
  }

  private wireConnection(conn: DataConnection) {
    log(`wireConnection — wiring peer "${conn.peer}" (isHost=${this.isHost})`);
    this.connections.set(conn.peer, conn);
    this.emitConnState();
    this.emitNewPeer(conn.peer);
    conn.on("data", (raw) => {
      const msg = raw as P2PMessage;
      log(`← received "${msg.type}" from "${msg.senderId || conn.peer}"`);
      const h = this.handlers.get(msg.type);
      if (h) {
        h(msg.data, msg.senderId);
      } else {
        warn(`no handler registered for message type "${msg.type}"`);
      }
      // Host relays all messages (including sync-room from guests) to other peers.
      if (this.isHost) this.relay(msg, conn.peer);
    });
    conn.on("close", () => {
      warn(`connection to "${conn.peer}" closed`);
      this.connections.delete(conn.peer);
      this.emitConnState();
    });
    conn.on("error", (e) => {
      err(`connection error with "${conn.peer}":`, e);
      this.connections.delete(conn.peer);
      this.emitConnState();
    });
  }

  private relay(msg: P2PMessage, exceptPeerId: string) {
    for (const [pid, c] of this.connections) {
      if (pid === exceptPeerId) continue;
      log(`→ relaying "${msg.type}" to "${pid}"`);
      try { c.send(msg); } catch { /* ignore */ }
    }
  }

  on(type: MessageType, handler: Handler) {
    this.handlers.set(type, handler);
  }

  broadcast(type: MessageType, data: unknown) {
    const message: P2PMessage = { type, data, timestamp: Date.now(), senderId: this.selfId };
    const targets = [...this.connections.keys()];
    if (targets.length === 0) {
      warn(`broadcast "${type}" — no connections to send to`);
    } else {
      log(`→ broadcast "${type}" to ${targets.length} peer(s): [${targets.join(", ")}]`);
    }
    for (const c of this.connections.values()) {
      try { c.send(message); } catch { /* ignore */ }
    }
  }

  sendTo(peerId: string, type: MessageType, data: unknown) {
    const c = this.connections.get(peerId);
    if (!c) {
      warn(`sendTo "${peerId}" — connection not found for type "${type}"`);
      return;
    }
    log(`→ sendTo "${peerId}" type="${type}"`);
    c.send({ type, data, timestamp: Date.now(), senderId: this.selfId });
  }

  onConnectionChange(cb: (connected: boolean) => void): () => void {
    this.connStateListeners.add(cb);
    return () => this.connStateListeners.delete(cb);
  }

  private emitConnState() {
    const connected = this.connections.size > 0;
    log(`emitConnState — connected=${connected} (${this.connections.size} peer(s))`);
    for (const cb of this.connStateListeners) cb(connected);
  }

  hasConnections(): boolean { return this.connections.size > 0; }

  // Reconnect a joiner to the host — reinitialises the peer if it's been destroyed.
  async reconnectToHost(roomCode: string): Promise<void> {
    log(`reconnectToHost — room "${roomCode}"`);
    if (!this.peer || (this.peer as unknown as { destroyed?: boolean }).destroyed) {
      log("reconnectToHost — peer destroyed, reinitialising");
      await this.initJoiner();
    }
    return this.connectToHost(roomCode);
  }

  async destroy() {
    log("destroy — tearing down peer and connections");
    for (const c of this.connections.values()) {
      try { c.close(); } catch { /* ignore */ }
    }
    this.connections.clear();
    if (this.peer) {
      try { this.peer.destroy(); } catch { /* ignore */ }
      this.peer = null;
    }
    this.selfId = "";
    this.isHost = false;
    // Clear all listeners so repeated init() calls don't accumulate handlers.
    this.handlers.clear();
    this.connStateListeners.clear();
    this.newPeerListeners.clear();
  }
}

export const peerManager = new PeerManager();
