import { useState, useEffect, useCallback } from 'react'
import { dataService, Message } from '../dataService'

export interface UseChatReturn {
  messages: Message[]
  newMsg: string
  setNewMsg: React.Dispatch<React.SetStateAction<string>>
  isChatOpen: boolean
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>
  loadMessages: () => Promise<void>
  sendMessage: (sender: string) => Promise<boolean>
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState<string>('')
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false)

  const loadMessages = useCallback(async () => {
    try {
      const list = await dataService.getMessages()
      setMessages(list)
    } catch (err) {
      console.error('Failed to load chat messages:', err)
    }
  }, [])

  const sendMessage = useCallback(async (sender: string): Promise<boolean> => {
    if (!newMsg.trim()) return false
    try {
      const success = await dataService.sendMessage(sender, newMsg.trim())
      if (success) {
        setNewMsg('')
        await loadMessages()
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to send message:', err)
      return false
    }
  }, [newMsg, loadMessages])

  // Poll messages every 5 seconds
  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
  }, [loadMessages])

  return {
    messages,
    newMsg,
    setNewMsg,
    isChatOpen,
    setIsChatOpen,
    loadMessages,
    sendMessage
  }
}
