import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from '../config';
import { authenticateSocket, identityOf } from './authSocket';
import { registerChatEvents } from './chatEvents';
import { broadcastPresenceToAllCustomerRooms } from './presence';
import { OPERATORS_CHANNEL } from './rooms';

let io: Server | null = null;

export function createSocketServer(httpServer: HttpServer): Server {
  const server = new Server(httpServer, {
    allowRequest: (req, callback) => callback(null, !req.headers.origin || config.corsOrigins.includes(req.headers.origin)),
    cors: {
      origin: config.corsOrigins,
      credentials: true
    },
    // 연결이 끊긴 걸 25초 안에 알아채도록 한다.
    pingInterval: 20_000,
    pingTimeout: 25_000
  });

  io = server;
  server.use((socket, next) => {
    void authenticateSocket(socket, next).catch(() => next(new Error('UNAUTHORIZED')));
  });

  server.on('connection', (socket) => {
    const identity = identityOf(socket);
    if (!identity) {
      socket.disconnect(true);
      return;
    }

    // 운영자는 자동으로 공용 알림 방에 들어간다.
    if (identity.kind === 'operator') {
      void socket.join(OPERATORS_CHANNEL);

      // 운영자가 들어왔다. 대기 중인 고객들에게 알린다.
      broadcastPresenceToAllCustomerRooms(server);

      socket.on('disconnect', () => {
        // disconnect 핸들러가 먼저 실행되면 아직 목록에 남아 있을 수 있으므로
        // 다음 이벤트 루프에서 센다.
        setImmediate(() => broadcastPresenceToAllCustomerRooms(server));
      });
    }

    registerChatEvents(server, socket);
  });

  return server;
}

/**
 * 라우터(HTTP) 쪽에서도 브로드캐스트해야 할 때 쓴다.
 * 소켓 서버가 아직 없으면 null 을 반환하므로, 호출부는 반드시 null 을 확인한다.
 * (테스트에서 소켓 없이 앱만 띄우는 경우가 있다)
 */
export function getIo(): Server | null {
  return io;
}
