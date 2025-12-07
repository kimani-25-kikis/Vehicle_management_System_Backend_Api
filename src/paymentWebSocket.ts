// paymentWebSocket.ts
import { io, Socket } from 'socket.io-client'

class PaymentWebSocket {
  private socket: Socket | null = null
  private paymentCallbacks: Map<number, (data: any) => void> = new Map()

  connect(token: string) {
    this.socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket']
    })

    this.socket.on('connect', () => {
      console.log('WebSocket connected for payment updates')
    })

    this.socket.on('payment:completed', (data: any) => {
      console.log('Payment completed via WebSocket:', data)
      const callback = this.paymentCallbacks.get(data.payment_id)
      if (callback) {
        callback(data)
      }
    })

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
    })
  }

  subscribeToPayment(paymentId: number, callback: (data: any) => void) {
    this.paymentCallbacks.set(paymentId, callback)
    this.socket?.emit('subscribe:payment', paymentId)
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
}

export const paymentWebSocket = new PaymentWebSocket()