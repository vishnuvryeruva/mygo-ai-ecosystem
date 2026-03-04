import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const backendRes = await fetch(`${BACKEND_URL}/api/generate-test-cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const contentType = backendRes.headers.get('content-type') || ''

    if (!backendRes.ok) {
      const errorText = await backendRes.text()
      return NextResponse.json(
        { error: errorText || 'Backend error' },
        { status: backendRes.status }
      )
    }

    // Binary response (excel / word download)
    if (
      contentType.includes('application/vnd') ||
      contentType.includes('octet-stream')
    ) {
      const buffer = await backendRes.arrayBuffer()
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition':
            backendRes.headers.get('content-disposition') || 'attachment',
        },
      })
    }

    // JSON response (preview)
    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('generate-test-cases proxy error:', error)
    return NextResponse.json({ error: 'Failed to reach backend' }, { status: 500 })
  }
}
