import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

export const maxDuration = 30

export async function GET(
  req: NextRequest,
  { params }: { params: { source_id: string } }
) {
  try {
    const { source_id } = params
    const { searchParams } = new URL(req.url)
    const queryString = searchParams.toString()

    const backendRes = await fetch(
      `${BACKEND_URL}/api/calm/${source_id}/requirements${queryString ? `?${queryString}` : ''}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (!backendRes.ok) {
      const errorText = await backendRes.text()
      console.error('Backend error:', errorText)
      return NextResponse.json(
        { error: errorText || 'Backend error' },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('requirements proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}
