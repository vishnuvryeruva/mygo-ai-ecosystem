import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { document_id: string } }
) {
  try {
    const { document_id } = params
    
    const backendRes = await fetch(
      `${BACKEND_URL}/api/documents/${encodeURIComponent(document_id)}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (!backendRes.ok) {
      const errorText = await backendRes.text()
      console.error('Backend error:', errorText)
      return NextResponse.json(
        { error: errorText || 'Failed to delete document' },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Delete document proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}
