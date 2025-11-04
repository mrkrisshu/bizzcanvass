'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, db } from '@/lib/firebaseClient'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, doc, getDoc, setDoc, query, where, orderBy, getDocs } from 'firebase/firestore'
import { CanvasCard } from '@/components/CanvasCard'
import { UpgradeModal } from '@/components/UpgradeModal'
import { Button } from '@/components/ui/button'
import RuixenMoonChat from '@/components/ruixen-moon-chat'
import { Sparkles, LogOut, Crown } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [canvases, setCanvases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  
  // Form state
  const [businessIdea, setBusinessIdea] = useState('')
  const [industry, setIndustry] = useState('Tech')
  const [title, setTitle] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push('/auth/signin')
        return
      }
      // Set immediate fallback so UI renders even if Firestore stream fails
      setUser(u)
      setUserData((prev: any) =>
        prev ?? {
          id: u.uid,
          email: u.email || 'unknown@user.local',
          subscription_status: 'free',
          generation_count: 0,
          created_at: new Date().toISOString(),
        }
      )
      // Fetch real data in background
      ;(async () => {
        try {
          await fetchUserData(u.uid, u.email || null)
        } catch (e) {
          console.error('Error fetching/creating user data:', e)
        }
      })()
      ;(async () => {
        try {
          await fetchCanvases(u.uid)
        } catch (e) {
          console.error('Error fetching canvases:', e)
        }
      })()
    })
    return () => unsub()
  }, [])

  // After returning from Stripe success, verify session and refresh user
  useEffect(() => {
    const upgrade = searchParams.get('upgrade')
    const sessionId = searchParams.get('session_id')
    if (upgrade === 'success' && sessionId) {
      ;(async () => {
        try {
          const res = await fetch('/api/checkout/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
          })
          // Regardless of result, refresh user data shortly after to capture webhook/verify
          setTimeout(() => {
            if (user?.uid) {
              fetchUserData(user.uid, user.email || null)
            }
          }, 1000)
        } catch (e) {
          console.error('Upgrade verify error', e)
        }
      })()
    }
  }, [searchParams, user])

  // Superseded by onAuthStateChanged

  const fetchUserData = async (userId: string, email: string | null) => {
    try {
      const userRef = doc(db, 'users', userId)
      const snap = await getDoc(userRef)
      if (!snap.exists()) {
        const defaultData = {
          id: userId,
          email: email || 'unknown@user.local',
          subscription_status: 'free',
          generation_count: 0,
          created_at: new Date().toISOString(),
        }
        await setDoc(userRef, defaultData)
        setUserData(defaultData)
      } else {
        setUserData(snap.data())
      }
    } catch (e) {
      console.error('Firestore user data error:', e)
      // Fallback to default data so the dashboard can render
      setUserData({
        id: userId,
        email: email || 'unknown@user.local',
        subscription_status: 'free',
        generation_count: 0,
        created_at: new Date().toISOString(),
      })
    }
  }

  const fetchCanvases = async (userId: string) => {
    try {
      const canvasesRef = collection(db, 'canvases')
      // Avoid composite index requirement by sorting client-side
      const q = query(canvasesRef, where('user_id', '==', userId))
      const snaps = await getDocs(q)
      const list = snaps.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
      const sorted = list.sort((a: any, b: any) => 
        String(b.created_at || '').localeCompare(String(a.created_at || ''))
      )
      setCanvases(sorted)
    } catch (e) {
      console.error('Firestore canvases fetch error:', e)
      // Safe fallback
      setCanvases([])
    }
  }

  const handleGenerate = async (businessIdea: string) => {
    setLoading(true)

    try {
      // Get the session token
      const current = auth.currentUser
      if (!current) {
        alert('Please sign in again')
        router.push('/auth/signin')
        return
      }
      const token = await current.getIdToken()

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          businessIdea, 
          industry: 'General', 
          title: businessIdea.slice(0, 50) 
        }),
      })

      const data = await response.json()

      if (response.status === 403 && data.upgrade_required) {
        setShowUpgradeModal(true)
        setLoading(false)
        return
      }

      if (data.error) {
        alert(data.error)
        setLoading(false)
        return
      }

      // Redirect to the new canvas
      router.push(`/canvas/${data.canvas.id}`)
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to generate canvas. Please try again.')
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/')
  }

  if (!user || !userData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Sparkles className="size-4 text-blue-400" />
            </div>
            <span className="text-xl font-bold">BizCanvas</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="text-sm">
              <span className="text-gray-400">Plan:</span>{' '}
              <span className={userData.subscription_status === 'premium' ? 'text-yellow-400 font-semibold' : 'text-gray-300'}>
                {userData.subscription_status === 'premium' ? (
                  <span className="flex items-center gap-1">
                    <Crown className="w-4 h-4" /> Pro
                  </span>
                ) : (
                  'Free'
                )}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-400">Generations:</span>{' '}
              <span className="text-gray-300">
                {userData.generation_count}
                {userData.subscription_status === 'free' && '/3'}
              </span>
            </div>
            {userData.subscription_status === 'free' && (
              <Button
                onClick={() => setShowUpgradeModal(true)}
                className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white text-xs px-3 py-1 h-auto"
              >
                <Crown className="w-3 h-3 mr-1" />
                Upgrade to Pro
              </Button>
            )}
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="flex items-center gap-2 border-gray-700 hover:bg-gray-800"
              size="sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full">
        {/* AI Chat Interface - Full Screen */}
        <div>
            <RuixenMoonChat 
            userName={(user.displayName || (user.email ? user.email.split('@')[0] : 'User'))}
            onSubmit={handleGenerate}
          />
        </div>

        {/* Canvases List */}
        <div className="bg-black">
          <div className="container mx-auto px-4 py-8">
            <h2 className="text-2xl font-bold mb-4">Your Canvases</h2>
            {canvases.length === 0 ? (
              <div className="bg-black rounded-xl p-12 text-center border border-gray-900">
                <p className="text-gray-400">No canvases yet. Generate your first one above!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {canvases.map((canvas) => (
                  <CanvasCard
                    key={canvas.id}
                    id={canvas.id}
                    title={canvas.title}
                    createdAt={canvas.created_at}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  )
}
