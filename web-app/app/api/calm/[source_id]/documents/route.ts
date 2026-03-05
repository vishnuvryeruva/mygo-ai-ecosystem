import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

// Increase timeout for fetching documents and test cases
export const maxDuration = 30 // 30 seconds

export async function GET(
  req: NextRequest,
  { params }: { params: { source_id: string } }
) {
  try {
    const { source_id } = params
    const { searchParams } = new URL(req.url)
    
    // Build query string from all search params
    const queryString = searchParams.toString()

    console.log(`Fetching documents/test cases for source: ${source_id}`)

    const backendRes = await fetch(
      `${BACKEND_URL}/api/calm/${source_id}/documents${queryString ? `?${queryString}` : ''}`,
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
    console.error('documents proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}
