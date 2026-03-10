import { FastifyInstance } from "fastify";

// WebSocket handler for real-time notifications
interface WSClient {
    socket: any;
    userId: string;
    role: string;
    wallet: string;
}

const clients: Set<WSClient> = new Set();

export async function wsHandler(app: FastifyInstance) {
    app.get("/ws", { websocket: true }, (socket: any, request: any) => {
        const client: WSClient = {
            socket,
            userId: "anonymous",
            role: "public",
            wallet: "",
        };

        clients.add(client);
        console.log(`🔌 WebSocket client connected (total: ${clients.size})`);

        // Handle incoming messages
        socket.on("message", (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());

                switch (message.type) {
                    case "auth":
                        // Client authenticates with JWT token
                        try {
                            const decoded: any = app.jwt.verify(message.token);
                            client.userId = decoded.sub;
                            client.role = decoded.role;
                            client.wallet = decoded.wallet;
                            socket.send(JSON.stringify({ type: "auth_success", userId: client.userId }));
                        } catch {
                            socket.send(JSON.stringify({ type: "auth_error", error: "Invalid token" }));
                        }
                        break;

                    case "subscribe":
                        // Subscribe to specific tender updates
                        socket.send(JSON.stringify({
                            type: "subscribed",
                            channel: message.channel,
                            message: `Subscribed to ${message.channel}`,
                        }));
                        break;

                    case "ping":
                        socket.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
                        break;

                    default:
                        socket.send(JSON.stringify({ type: "error", error: "Unknown message type" }));
                }
            } catch {
                socket.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
            }
        });

        // Handle disconnect
        socket.on("close", () => {
            clients.delete(client);
            console.log(`🔌 WebSocket client disconnected (total: ${clients.size})`);
        });

        // Send welcome message
        socket.send(JSON.stringify({
            type: "welcome",
            message: "Connected to TenderChain real-time feed",
            timestamp: Date.now(),
        }));
    });
}

// Broadcast to all connected clients
export function broadcast(event: any) {
    const message = JSON.stringify(event);
    for (const client of clients) {
        try {
            client.socket.send(message);
        } catch {
            clients.delete(client);
        }
    }
}

// Broadcast to clients with specific role
export function broadcastToRole(role: string, event: any) {
    const message = JSON.stringify(event);
    for (const client of clients) {
        if (client.role === role) {
            try {
                client.socket.send(message);
            } catch {
                clients.delete(client);
            }
        }
    }
}
