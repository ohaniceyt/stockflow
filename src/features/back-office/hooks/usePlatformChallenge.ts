import * as React from 'react'
import { PlatformChallengeContext } from '../context/platformChallengeContext'

export function usePlatformChallenge(): {
  requestChallenge: (title?: string) => Promise<string>
} {
  const ctx = React.useContext(PlatformChallengeContext)
  if (!ctx) {
    throw new Error('usePlatformChallenge must be used within PlatformChallengeProvider')
  }
  return ctx
}
