import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@/lib/firebaseAdmin'

// POST /api/checkout/verify
// Body: { session_id: string }
// Verifies the Checkout Session after redirect and upgrades user as a fallback
export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json()
    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY || ''
    if (!stripeSecret) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    const stripe = new Stripe(stripeSecret)
    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (!session || !session.client_reference_id) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
    }

    // Only upgrade if the session completed/paid
    const paid = session.payment_status === 'paid' || session.status === 'complete'
    if (!paid) {
      return NextResponse.json({ verified: false, reason: 'Session not paid' }, { status: 200 })
    }

    const email = (session.customer_details && session.customer_details.email) || session.customer_email || 'unknown@user.local'
    const userId = session.client_reference_id

    try {
      await adminDb.collection('users').doc(userId).set(
        { id: userId, email, subscription_status: 'premium' },
        { merge: true }
      )
    } catch (err) {
      console.error('Verify: Firestore update error', err)
      return NextResponse.json({ error: 'Failed to upgrade user' }, { status: 500 })
    }

    return NextResponse.json({ verified: true, upgraded: true })
  } catch (err: any) {
    console.error('Verify error', err)
    return NextResponse.json({ error: err.message || 'Verify failed' }, { status: 500 })
  }
}
