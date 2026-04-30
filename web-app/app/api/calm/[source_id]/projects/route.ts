import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

export async function GET(
  req: NextRequest,
  { params }: { params: { source_id: string } }
) {
  try {
    const { source_id } = params

    const backendRes = await fetch(
      `${BACKEND_URL}/api/calm/${source_id}/projects`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (!backendRes.ok) {
      let errorMessage = 'Backend error'
      const rawError = await backendRes.text()
      if (rawError) {
        try {
          const errorJson = JSON.parse(rawError)
          errorMessage = errorJson?.error || rawError
        } catch {
          errorMessage = rawError
        }
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('projects proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}
