import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams.toString()
    const url = `${BACKEND_URL}/api/code${params ? `?${params}` : ''}`

    const backendRes = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!backendRes.ok) {
      const errorText = await backendRes.text()
      console.error('Backend error:', errorText)
      return NextResponse.json(
        { error: errorText || 'Failed to fetch code objects' },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Code proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}
