export function useOnboardingGuide() {
  const isFirstTime = (key) => {
    try {
      return !localStorage.getItem(key)
    } catch {
      return true
    }
  }

  const markDone = (key) => {
    try {
      localStorage.setItem(key, 'true')
    } catch {
      // ignore
    }
  }

  const clearDone = (key) => {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }

  return {
    isFirstTime,
    markDone,
    clearDone
  }
}