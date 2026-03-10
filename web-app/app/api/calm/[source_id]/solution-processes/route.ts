import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

export async function GET(
  req: NextRequest,
  { params }: { params: { source_id: string } }
) {
  try {
    const { source_id } = params
    const { searchParams } = new URL(req.url)
    const scopeId = searchParams.get('scopeId')

    if (!scopeId) {
      return NextResponse.json(
        { error: 'scopeId is required' },
        { status: 400 }
      )
    }

    const backendRes = await fetch(
      `${BACKEND_URL}/api/calm/${source_id}/solution-processes?scopeId=${scopeId}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (!backendRes.ok) {
      const errorText = await backendRes.text()
      return NextResponse.json(
        { error: errorText || 'Backend error' },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('solution-processes proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}
