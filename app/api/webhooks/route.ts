import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@/lib/firebaseAdmin'

export async function POST(req: NextRequest) {
  // Initialize Stripe (use account default API version)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const userId = session.client_reference_id

    if (!userId) {
      console.error('No user ID found in checkout session')
      return NextResponse.json({ error: 'No user ID' }, { status: 400 })
    }

    // Ensure a user doc exists and set subscription to premium in Firestore
    const email = (session.customer_details && session.customer_details.email) || session.customer_email || undefined
    const userRef = adminDb.collection('users').doc(userId)
    try {
      await userRef.set(
        {
          id: userId,
          email: email || 'unknown@user.local',
          subscription_status: 'premium',
        },
        { merge: true }
      )
    } catch (err) {
      console.error('Error updating user subscription in Firestore:', err)
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      )
    }

    console.log(`User ${userId} upgraded to premium via webhook`)
  }

  return NextResponse.json({ received: true })
}
