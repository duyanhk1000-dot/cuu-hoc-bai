import { useState, useEffect, useCallback } from 'react'

export interface UseTimerReturn {
  timeLeft: number
  isTimerRunning: boolean
  startTimer: (durationSeconds: number) => void
  stopTimer: () => void
  resetTimer: () => void
  formatTime: (seconds: number) => string
}

export function useTimer(onTimeOut?: () => void): UseTimerReturn {
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false)

  useEffect(() => {
    let timerId: any
    if (isTimerRunning && timeLeft > 0) {
      timerId = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    } else if (isTimerRunning && timeLeft === 0) {
      setIsTimerRunning(false)
      if (onTimeOut) {
        onTimeOut()
      }
    }
    return () => clearTimeout(timerId)
  }, [isTimerRunning, timeLeft, onTimeOut])

  const startTimer = useCallback((durationSeconds: number) => {
    setTimeLeft(durationSeconds)
    setIsTimerRunning(true)
  }, [])

  const stopTimer = useCallback(() => {
    setIsTimerRunning(false)
  }, [])

  const resetTimer = useCallback(() => {
    setTimeLeft(0)
    setIsTimerRunning(false)
  }, [])

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  return {
    timeLeft,
    isTimerRunning,
    startTimer,
    stopTimer,
    resetTimer,
    formatTime
  }
}
