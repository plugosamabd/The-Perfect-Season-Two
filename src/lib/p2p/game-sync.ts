import { peerManager } from "./peer-manager";
import { useP2PStore, type GameRoom, type ChatMessage } from "./store";
import { saveRoomSnapshot } from "./room-manager";

const HEARTBEAT_MS = 10_000;
const RECONNECT_DELAY_MS = 3_000;

const log = (...args: unknown[]) => console.log("[GameSync]", ...args);
const warn = (...args: unknown[]) => console.warn("[GameSync]", ...args);

class GameSync {
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  init() {
    log("init — registering message handlers");

    peerManager.on("sync-room", (data) => {
      const room = data as GameRoom;
      log(`sync-room received — phase="${room.phase}" players=${room.players.length} code="${room.code}"`);
      useP2PStore.setState({ room });
      if (peerManager.isHost) {
        saveRoomSnapshot(room);
        // Re-broadcast to all other peers so guests receive each other's actions.
        log("sync-room — host re-broadcasting to other peers");
        peerManager.broadcast("sync-room", room);
      }
    });

    peerManager.on("request-sync", (_data, senderId) => {
      log(`request-sync received from "${senderId}"`);
      const room = useP2PStore.getState().room;
      if (room && peerManager.isHost) {
        log(`request-sync — responding to "${senderId}" with room phase="${room.phase}"`);
        peerManager.sendTo(senderId, "sync-room", room);
      } else if (!peerManager.isHost) {
        warn("request-sync — ignored (not host)");
      } else {
        warn("request-sync — no room state to send yet");
      }
    });

    // "hello" is an explicit handshake from joiners — host replies immediately
    // with full room state. More reliable than relying on timing alone.
    peerManager.on("hello", (_data, senderId) => {
      log(`hello received from "${senderId}"`);
      if (!peerManager.isHost) { warn("hello — ignored (not host)"); return; }
      const room = useP2PStore.getState().room;
      if (room) {
        log(`hello — responding to "${senderId}" with room phase="${room.phase}"`);
        peerManager.sendTo(senderId, "sync-room", room);
      } else {
        warn(`hello — no room state to send to "${senderId}" yet`);
      }
    });

    peerManager.on("chat", (data) => {
      useP2PStore.getState().addMessage(data as ChatMessage);
    });

    // When the host gets a new connection, proactively push the current room state
    // so the joiner doesn't have to wait for their request-sync message to arrive.
    peerManager.onNewPeer((peerId) => {
      if (!peerManager.isHost) return;
      const room = useP2PStore.getState().room;
      if (!room) { warn(`onNewPeer "${peerId}" — no room state yet, skipping proactive push`); return; }
      log(`onNewPeer "${peerId}" — scheduling proactive sync at 400ms and 1.5s`);
      // Send at 400ms, then again at 1.5s as a fallback in case the first
      // message is dropped before the joiner's DataChannel is fully ready.
      setTimeout(() => {
        const currentRoom = useP2PStore.getState().room;
        if (currentRoom) {
          log(`proactive sync (400ms) → "${peerId}" phase="${currentRoom.phase}"`);
          peerManager.sendTo(peerId, "sync-room", currentRoom);
        }
      }, 400);
      setTimeout(() => {
        const currentRoom = useP2PStore.getState().room;
        if (currentRoom) {
          log(`proactive sync (1.5s) → "${peerId}" phase="${currentRoom.phase}"`);
          peerManager.sendTo(peerId, "sync-room", currentRoom);
        }
      }, 1_500);
    });

    peerManager.onConnectionChange((c) => {
      log(`connectionChange — connected=${c}`);
      useP2PStore.setState({ connected: c });
      // If we're a guest and just lost our connection mid-game, schedule a reconnect.
      if (!c && !peerManager.isHost) {
        warn("connectionChange — lost connection as guest, scheduling reconnect");
        this.scheduleReconnect();
      }
    });

    this.startHeartbeat();
  }

  private startHeartbeat() {
    if (this.heartbeatId) clearInterval(this.heartbeatId);
    this.heartbeatId = setInterval(() => {
      const room = useP2PStore.getState().room;
      if (!room || peerManager.isHost) return;
      if (!peerManager.hasConnections()) {
        warn("heartbeat — no connections, scheduling reconnect");
        this.scheduleReconnect();
      } else {
        log("heartbeat — requesting sync");
        this.requestSync();
      }
    }, HEARTBEAT_MS);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const room = useP2PStore.getState().room;
    // Allow reconnection in any phase — including lobby. A dropped connection
    // during lobby means the joiner won't receive the "start draft" broadcast.
    if (!room || room.phase === "result") return;
    log(`scheduleReconnect — will retry in ${RECONNECT_DELAY_MS}ms for room "${room.code}"`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      const currentRoom = useP2PStore.getState().room;
      if (!currentRoom || currentRoom.phase === "result") return;
      log(`scheduleReconnect — attempting reconnect to room "${currentRoom.code}"`);
      try {
        await peerManager.reconnectToHost(currentRoom.code);
        log("scheduleReconnect — reconnected, requesting sync");
        this.requestSync();
      } catch (e) {
        warn("scheduleReconnect — reconnect failed, will retry on next heartbeat:", e);
      }
    }, RECONNECT_DELAY_MS);
  }

  syncRoom(room: GameRoom) {
    log(`syncRoom — phase="${room.phase}" players=${room.players.length}`);
    useP2PStore.setState({ room });
    if (peerManager.isHost) saveRoomSnapshot(room);
    peerManager.broadcast("sync-room", room);
  }

  requestSync() {
    log("requestSync — broadcasting request-sync");
    peerManager.broadcast("request-sync", null);
  }

  sendChat(msg: ChatMessage) {
    useP2PStore.getState().addMessage(msg);
    peerManager.broadcast("chat", msg);
  }

  destroy() {
    if (this.heartbeatId) { clearInterval(this.heartbeatId); this.heartbeatId = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }
}

export const gameSync = new GameSync();
