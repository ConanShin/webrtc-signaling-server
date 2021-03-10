import {
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets'
import { Socket } from 'socket.io'

import { Server } from 'ws'
import { Logger } from '@nestjs/common'

@WebSocketGateway({ namespace: 'chat'})
export class MessageGateway implements OnGatewayInit, OnGatewayDisconnect {
    @WebSocketServer() server: Server

    private activeSockets: { room: string; name: string, id: string }[] = []

    private logger: Logger = new Logger('MessageGateway')

    @SubscribeMessage('joinRoom')
    public joinRoom(client: Socket, info: any): void {
        const existingSocket = this.activeSockets?.find(
            (socket) => socket.room === info.roomName && socket.id === client.id,
        )

        if (!existingSocket) {
            this.activeSockets = [...this.activeSockets, { id: client.id, name: info.name, room: info.roomName }]
        }

        this.logger.log(`Client ${client.id} joined ${info.roomName}`)

        client.join(info.roomName)

        const users = this.activeSockets
            .filter((socket) => socket.room === info.roomName)
            .map((existingSocket) => existingSocket.name)
        client.to(info.roomName).broadcast.emit('joined-users', users)
        client.emit('joined-users', users)
    }

    @SubscribeMessage('call-user')
    public callUser(client: Socket, data: any): void {
        console.log('calling users from ', data.name, ' to ', data.to)
        client.to(data.to).emit('call-made', {
            offer: data.offer,
            name: data.name,
            socket: client.id,
        })
    }

    @SubscribeMessage('make-answer')
    public makeAnswer(client: Socket, data: any): void {
        client.to(data.to).emit('answer-made', {
            answer: data.answer,
            name: data.name,
            socket: client.id,
        })
    }

    @SubscribeMessage('reject-call')
    public rejectCall(client: Socket, data: any): void {
        client.to(data.from).emit('call-rejected', {
            socket: client.id,
        })
    }

    public afterInit(server: Server): void {
        this.logger.log('Init')
    }

    public handleDisconnect(client: Socket): void {
        const existingSocket = this.activeSockets.find(
            (socket) => socket.id === client.id,
        )

        if (!existingSocket) return

        this.activeSockets = this.activeSockets.filter(
            (socket) => socket.id !== client.id,
        )

        client.to(existingSocket.room).emit('joined-users', {
            users: this.activeSockets
                .filter((socket) => socket.room === existingSocket.room)
                .map((existingSocket) => existingSocket.name),
        })

        this.logger.log(`Client disconnected: ${client.id}`)
    }
}