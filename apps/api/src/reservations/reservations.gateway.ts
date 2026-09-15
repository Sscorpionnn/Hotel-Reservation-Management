import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

/**
 * Pushes availability-changed events so clients refresh their search
 * results instead of polling the availability endpoint on a timer —
 * keeps read load (and token/API spend on any downstream provider calls)
 * down under normal browsing traffic.
 */
@WebSocketGateway({
  namespace: "/ws/availability",
  cors: { origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",") },
})
export class ReservationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ReservationsGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  @SubscribeMessage("subscribe:hotel")
  handleSubscribe(client: Socket, hotelId: string) {
    client.join(roomFor(hotelId));
  }

  @SubscribeMessage("unsubscribe:hotel")
  handleUnsubscribe(client: Socket, hotelId: string) {
    client.leave(roomFor(hotelId));
  }

  broadcastAvailabilityChanged(hotelId: string, roomTypeId: string | null) {
    this.server?.to(roomFor(hotelId)).emit("availability:changed", { hotelId, roomTypeId });
  }
}

function roomFor(hotelId: string): string {
  return `hotel:${hotelId}`;
}
