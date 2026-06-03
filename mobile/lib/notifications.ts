import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'

export type NotificationPermission = 'granted' | 'denied' | 'prompt'

async function requestPermission(): Promise<NotificationPermission> {
  if (!Capacitor.isNativePlatform()) return 'denied'

  const result = await PushNotifications.requestPermissions()
  if (result.receive === 'granted') {
    await PushNotifications.register()
    return 'granted'
  }
  return result.receive === 'denied' ? 'denied' : 'prompt'
}

function addListeners(onToken: (token: string) => void) {
  if (!Capacitor.isNativePlatform()) return

  PushNotifications.addListener('registration', ({ value }) => {
    onToken(value)
  })

  PushNotifications.addListener('registrationError', (err) => {
    console.error('[OFTA Push] Registration error:', err)
  })

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[OFTA Push] Received:', notification.title)
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[OFTA Push] Action:', action.actionId, action.notification.data)
  })
}

export const notifications = { requestPermission, addListeners }
