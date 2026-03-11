import { defineStore } from 'pinia'

export interface NotificationItem {
  id: string
  type: string
  message: string
  isRead: boolean
  timestamp: string
}

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    notifications: [] as NotificationItem[],
  }),
  getters: {
    unreadCount: (state) => {
      return state.notifications.filter(n => !n.isRead).length
    },
    hasUnread(): boolean {
      return this.unreadCount > 0
    }
  },
  actions: {
    pushNotification(notification: Omit<NotificationItem, 'id' | 'isRead' | 'timestamp'>) {
      const newNotification: NotificationItem = {
        ...notification,
        id: crypto.randomUUID(),
        isRead: false,
        timestamp: new Date().toISOString()
      }
      this.notifications.unshift(newNotification)
    },
    markAsRead(id: string) {
      const notification = this.notifications.find(n => n.id === id)
      if (notification) {
        notification.isRead = true
      }
    },
    markAllAsRead() {
      this.notifications.forEach(n => n.isRead = true)
    },
    clearAll() {
      this.notifications = []
    }
  }
})
