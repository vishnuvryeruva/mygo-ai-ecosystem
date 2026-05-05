import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

export async function GET(req: NextRequest) {
  try {
    // Forward all query params (page, page_size, search, source, type, project, date_from, date_to)
    const params = req.nextUrl.searchParams.toString()
    const url = `${BACKEND_URL}/api/documents${params ? `?${params}` : ''}`

    const backendRes = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!backendRes.ok) {
      const errorText = await backendRes.text()
      console.error('Backend error:', errorText)
      return NextResponse.json(
        { error: errorText || 'Failed to fetch documents' },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Documents proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}
