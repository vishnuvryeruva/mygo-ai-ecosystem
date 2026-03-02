import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { description } = body

        // Return a mock markdown response for demonstration
        const mockSpec = `
**Functional Specification**

Based on your requirement: *"${description || 'N/A'}"*

Here is the generated outline:
- **Scope**: Define the boundaries of the system.
- **User Roles**: Admins, Standard Users.
- **Key Features**:
  1. Automated data processing.
  2. PDF export functionality.
  3. Real-time syncing.

\`\`\`json
{
  "status": "draft",
  "version": "1.0",
  "author": "Spec Agent"
}
\`\`\`

You can refine this further, or open the full Spec Editor to add diagrams and export to Word.
`

        return NextResponse.json({ spec: mockSpec })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
    }
}
