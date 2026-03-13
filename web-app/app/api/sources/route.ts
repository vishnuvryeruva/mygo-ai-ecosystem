import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

export async function GET(req: NextRequest) {
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/sources`, {
      method: 'GET',
    })

    if (!backendRes.ok) {
      const errorText = await backendRes.text()
      console.error('Backend error (GET /api/sources):', errorText)
      return NextResponse.json(
        { error: errorText || 'Failed to fetch sources' },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Sources proxy error (GET /api/sources):', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const backendRes = await fetch(`${BACKEND_URL}/api/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!backendRes.ok) {
      const errorText = await backendRes.text()
      console.error('Backend error (POST /api/sources):', errorText)
      return NextResponse.json(
        { error: errorText || 'Failed to create source' },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Sources proxy error (POST /api/sources):', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}
