import { peerManager } from "./peer-manager";
import { useP2PStore, type GameRoom, type ChatMessage } from "./store";
import { saveRoomSnapshot } from "./room-manager";

const HEARTBEAT_MS = 10_000;
const RECONNECT_DELAY_MS = 3_000;

class GameSync {
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  init() {
    peerManager.on("sync-room", (data) => {
      const room = data as GameRoom;
      useP2PStore.setState({ room });
      if (peerManager.isHost) {
        saveRoomSnapshot(room);
        // Re-broadcast to all other peers so guests receive each other's actions.
        peerManager.broadcast("sync-room", room);
      }
    });
    peerManager.on("request-sync", (_data, senderId) => {
      const room = useP2PStore.getState().room;
      if (room && peerManager.isHost) peerManager.sendTo(senderId, "sync-room", room);
    });
    peerManager.on("chat", (data) => {
      useP2PStore.getState().addMessage(data as ChatMessage);
    });

    // When the host gets a new connection, proactively push the current room state
    // so the joiner doesn't have to wait for their request-sync message to arrive.
    peerManager.onNewPeer((peerId) => {
      if (!peerManager.isHost) return;
      const room = useP2PStore.getState().room;
      if (!room) return;
      // Send at 400ms, then again at 1.5s as a fallback in case the first
      // message is dropped before the joiner's DataChannel is fully ready.
      setTimeout(() => {
        const currentRoom = useP2PStore.getState().room;
        if (currentRoom) peerManager.sendTo(peerId, "sync-room", currentRoom);
      }, 400);
      setTimeout(() => {
        const currentRoom = useP2PStore.getState().room;
        if (currentRoom) peerManager.sendTo(peerId, "sync-room", currentRoom);
      }, 1_500);
    });

    peerManager.onConnectionChange((c) => {
      useP2PStore.setState({ connected: c });
      // If we're a guest and just lost our connection mid-game, schedule a reconnect.
      if (!c && !peerManager.isHost) {
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
        this.scheduleReconnect();
      } else {
        // Re-sync periodically to stay fresh while connected.
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
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      const currentRoom = useP2PStore.getState().room;
      if (!currentRoom || currentRoom.phase === "result") return;
      try {
        await peerManager.reconnectToHost(currentRoom.code);
        this.requestSync();
      } catch {
        // Will retry on next heartbeat tick.
      }
    }, RECONNECT_DELAY_MS);
  }

  syncRoom(room: GameRoom) {
    useP2PStore.setState({ room });
    if (peerManager.isHost) saveRoomSnapshot(room);
    peerManager.broadcast("sync-room", room);
  }

  requestSync() {
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
