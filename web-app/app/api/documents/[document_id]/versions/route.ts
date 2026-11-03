import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

export async function GET(
  req: NextRequest,
  { params }: { params: { document_id: string } }
) {
  try {
    const { document_id } = params
    const { searchParams } = new URL(req.url)
    const sourceId = searchParams.get('sourceId')

    let url = `${BACKEND_URL}/api/documents/${encodeURIComponent(document_id)}/versions`
    if (sourceId) {
      url += `?sourceId=${encodeURIComponent(sourceId)}`
    }

    const backendRes = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!backendRes.ok) {
      const errorText = await backendRes.text()
      return NextResponse.json(
        { error: errorText || 'Failed to fetch document versions' },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Document versions proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}
