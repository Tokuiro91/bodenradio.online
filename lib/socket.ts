"use client"

import { io, Socket } from "socket.io-client"

const SOCKET_URL = process.env.NEXT_PUBLIC_RADIO_BACKEND_URL || "https://backend.agileradio.online"

class SocketService {
    public socket: Socket | null = null

    connect() {
        if (this.socket) return this.socket

        this.socket = io(SOCKET_URL, {
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        })

        this.socket.on("connect", () => {
            console.log("[Socket] Connected to radio backend")
        })

        this.socket.on("disconnect", () => {
            console.log("[Socket] Disconnected")
        })

        return this.socket
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
        }
    }
}

export const socketService = new SocketService()
