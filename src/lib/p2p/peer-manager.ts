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

  async initHost(roomCode: string): Promise<string> {
    await this.destroy();
    this.isHost = true;
    const id = hostPeerId(roomCode);
    return this.bootPeer(id);
  }

  async initJoiner(): Promise<string> {
    await this.destroy();
    this.isHost = false;
    return this.bootPeer(undefined);
  }

  private bootPeer(id: string | undefined): Promise<string> {
    return new Promise((resolve, reject) => {
      // Default public PeerJS broker (0.peerjs.com) — no infra needed.
      const peer = id ? new Peer(id) : new Peer();
      this.peer = peer;
      const timer = setTimeout(() => reject(new Error("PeerJS connect timeout")), 12_000);
      peer.on("open", (openId) => {
        clearTimeout(timer);
        this.selfId = openId;
        peer.on("connection", (c) => this.wireConnection(c));
        resolve(openId);
      });
      peer.on("error", (err) => {
        clearTimeout(timer);
        // If we tried to claim a host id that's taken, surface a clean message.
        const msg = (err as { type?: string; message?: string }).message ?? String(err);
        reject(new Error(msg));
      });
    });
  }

  async connectToHost(roomCode: string): Promise<void> {
    if (!this.peer) throw new Error("Peer not initialised");
    const target = hostPeerId(roomCode);
    return new Promise((resolve, reject) => {
      const conn = this.peer!.connect(target, { reliable: true });
      const timer = setTimeout(() => reject(new Error("Host did not respond")), 12_000);
      conn.on("open", () => {
        clearTimeout(timer);
        this.wireConnection(conn);
        resolve();
      });
      conn.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private wireConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);
    this.emitConnState();
    conn.on("data", (raw) => {
      const msg = raw as P2PMessage;
      const h = this.handlers.get(msg.type);
      if (h) h(msg.data, msg.senderId);
      // Host relays all messages (including sync-room from guests) to other peers.
      if (this.isHost) this.relay(msg, conn.peer);
    });
    conn.on("close", () => {
      this.connections.delete(conn.peer);
      this.emitConnState();
    });
    conn.on("error", () => {
      this.connections.delete(conn.peer);
      this.emitConnState();
    });
  }

  private relay(msg: P2PMessage, exceptPeerId: string) {
    for (const [pid, c] of this.connections) {
      if (pid === exceptPeerId) continue;
      try { c.send(msg); } catch { /* ignore */ }
    }
  }

  on(type: MessageType, handler: Handler) {
    this.handlers.set(type, handler);
  }

  broadcast(type: MessageType, data: unknown) {
    const message: P2PMessage = { type, data, timestamp: Date.now(), senderId: this.selfId };
    for (const c of this.connections.values()) {
      try { c.send(message); } catch { /* ignore */ }
    }
  }

  sendTo(peerId: string, type: MessageType, data: unknown) {
    const c = this.connections.get(peerId);
    if (!c) return;
    c.send({ type, data, timestamp: Date.now(), senderId: this.selfId });
  }

  onConnectionChange(cb: (connected: boolean) => void): () => void {
    this.connStateListeners.add(cb);
    return () => this.connStateListeners.delete(cb);
  }

  private emitConnState() {
    const connected = this.connections.size > 0;
    for (const cb of this.connStateListeners) cb(connected);
  }

  hasConnections(): boolean { return this.connections.size > 0; }

  // Reconnect a joiner to the host — reinitialises the peer if it's been destroyed.
  async reconnectToHost(roomCode: string): Promise<void> {
    if (!this.peer || (this.peer as unknown as { destroyed?: boolean }).destroyed) {
      await this.initJoiner();
    }
    return this.connectToHost(roomCode);
  }

  async destroy() {
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
  }
}

export const peerManager = new PeerManager();
