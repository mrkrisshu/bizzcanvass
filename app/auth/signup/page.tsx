'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebaseClient'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { AnimatedAuth } from '@/components/ui/animated-auth'

export const dynamic = 'force-dynamic'

export default function SignUp() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const router = useRouter()

  const handleSignUp = async (email: string, password: string, name?: string) => {
    setLoading(true)
    setError('')

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password)
      if (name) {
        await updateProfile(userCred.user, { displayName: name })
      }
      // Navigate to dashboard
      window.location.href = '/dashboard'
    } catch (error: any) {
      setError(error.message || 'An error occurred during sign up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatedAuth 
      mode="signup" 
      onSubmit={handleSignUp}
      isLoading={loading}
      error={error}
      otherPageLink="/auth/signin"
    />
  )
}
