import { peerManager } from "./peer-manager";
import { useP2PStore, type GameRoom, type ChatMessage } from "./store";

class GameSync {
  init() {
    peerManager.on("sync-room", (data) => {
      useP2PStore.setState({ room: data as GameRoom });
    });
    peerManager.on("request-sync", (_data, senderId) => {
      const room = useP2PStore.getState().room;
      if (room && peerManager.isHost) peerManager.sendTo(senderId, "sync-room", room);
    });
    peerManager.on("chat", (data) => {
      useP2PStore.getState().addMessage(data as ChatMessage);
    });

    peerManager.onConnectionChange((c) => useP2PStore.setState({ connected: c }));
  }

  syncRoom(room: GameRoom) {
    useP2PStore.setState({ room });
    peerManager.broadcast("sync-room", room);
  }

  requestSync() {
    peerManager.broadcast("request-sync", null);
  }

  sendChat(msg: ChatMessage) {
    useP2PStore.getState().addMessage(msg);
    peerManager.broadcast("chat", msg);
  }
}

export const gameSync = new GameSync();
