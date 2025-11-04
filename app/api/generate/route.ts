import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { generateBusinessCanvas } from '@/lib/geminiClient'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized - No auth header' }, { status: 401 })
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')
    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(token)
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
    }

    const { businessIdea, industry, title } = await req.json()
    if (!businessIdea || !industry) {
      return NextResponse.json(
        { error: 'Missing required fields: businessIdea and industry' },
        { status: 400 }
      )
    }

    // Ensure user document exists
    const userRef = adminDb.collection('users').doc(decoded.uid)
    const userSnap = await userRef.get()
    if (!userSnap.exists) {
      await userRef.set({
        id: decoded.uid,
        email: decoded.email || 'unknown@user.local',
        subscription_status: 'free',
        generation_count: 0,
        created_at: new Date().toISOString(),
      })
    }
    const userData = (await userRef.get()).data() as any

    // Check free quota
    if (userData.subscription_status === 'free' && (userData.generation_count || 0) >= 3) {
      return NextResponse.json(
        { upgrade_required: true, message: 'Free limit (3) reached. Upgrade to Pro for unlimited canvases.' },
        { status: 403 }
      )
    }

    // Generate canvas via Gemini
    const canvasData = await generateBusinessCanvas(businessIdea, industry)

    // Save to Firestore
    const canvasesRef = adminDb.collection('canvases')
    const newCanvas = {
      user_id: decoded.uid,
      title: title || `${industry} Business Model Canvas`,
      data: canvasData as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const docRef = await canvasesRef.add(newCanvas)

    // Increment generation count
    await userRef.update({ generation_count: (userData.generation_count || 0) + 1 })

    return NextResponse.json({
      success: true,
      canvas: { id: docRef.id, ...newCanvas },
      generation_count: (userData.generation_count || 0) + 1,
    })
  } catch (error: any) {
    console.error('Generate API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate canvas' },
      { status: 500 }
    )
  }
}
