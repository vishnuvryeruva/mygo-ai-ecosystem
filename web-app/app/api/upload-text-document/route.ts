import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const backendRes = await fetch(`${BACKEND_URL}/api/upload-text-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!backendRes.ok) {
      const errorData = await backendRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.error || 'Failed to upload document to DMS' },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('upload-text-document proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}
