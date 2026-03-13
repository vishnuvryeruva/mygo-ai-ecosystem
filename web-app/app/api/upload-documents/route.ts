import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    
    // Forward the form data to the backend
    const backendRes = await fetch(`${BACKEND_URL}/api/upload-documents`, {
      method: 'POST',
      body: formData,
    })

    if (!backendRes.ok) {
      const errorText = await backendRes.text()
      console.error('Backend error:', errorText)
      return NextResponse.json(
        { error: errorText || 'Failed to upload documents' },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Upload documents proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to reach backend' },
      { status: 500 }
    )
  }
}
