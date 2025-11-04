'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebaseClient'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { AnimatedAuth } from '@/components/ui/animated-auth'

export const dynamic = 'force-dynamic'

export default function SignIn() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const router = useRouter()

  const handleSignIn = async (email: string, password: string) => {
    setLoading(true)
    setError('')

    try {
      await signInWithEmailAndPassword(auth, email, password)
      // Navigate to dashboard
      window.location.href = '/dashboard'
    } catch (error: any) {
      setError(error.message || 'An error occurred during sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatedAuth 
      mode="signin" 
      onSubmit={handleSignIn}
      isLoading={loading}
      error={error}
      otherPageLink="/auth/signup"
    />
  )
}
