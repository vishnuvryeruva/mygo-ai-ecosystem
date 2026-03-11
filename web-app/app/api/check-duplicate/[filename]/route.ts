import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params
    
    const backendRes = await fetch(
      `${BACKEND_URL}/api/check-duplicate/${encodeURIComponent(filename)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (!backendRes.ok) {
      const errorText = await backendRes.text()
      console.error('Backend error:', errorText)
      return NextResponse.json(
        { error: errorText || 'Failed to check duplicate' },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Check duplicate proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}
