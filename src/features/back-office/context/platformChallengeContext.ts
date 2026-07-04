import * as React from 'react'

export interface PlatformChallengeContextValue {
  requestChallenge: (title?: string) => Promise<string>
}

export const PlatformChallengeContext = React.createContext<PlatformChallengeContextValue | null>(
  null
)
