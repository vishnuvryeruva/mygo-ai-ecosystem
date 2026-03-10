import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

// Increase timeout for test case uploads (can take longer with multiple test cases)
export const maxDuration = 60 // 60 seconds

export async function POST(
  req: NextRequest,
  { params }: { params: { source_id: string } }
) {
  try {
    const body = await req.json()
    const { source_id } = params

    console.log(`Proxying push-test-cases request to backend for source: ${source_id}`)

    const backendRes = await fetch(
      `${BACKEND_URL}/api/calm/${source_id}/push-test-cases`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // No timeout on fetch - let it run as long as needed within maxDuration
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
    console.error('push-test-cases proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to reach backend or request timed out' },
      { status: 500 }
    )
  }
}
