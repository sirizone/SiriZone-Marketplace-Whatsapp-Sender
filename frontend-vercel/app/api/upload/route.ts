import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');

  if (!filename || !request.body) {
    return NextResponse.json({ error: 'Filename and body required' }, { status: 400 });
  }

  try {
    // If running locally without token, save to public/uploads
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.warn("Missing BLOB_READ_WRITE_TOKEN, falling back to local storage");
        
        const buffer = Buffer.from(await request.arrayBuffer());
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        
        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true });
        
        // Save file
        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);
        
        // Construct URL
        const host = request.headers.get('host');
        const protocol = host?.includes('localhost') || host?.includes('127.0.0.1') ? 'http' : 'https';
        const url = `${protocol}://${host}/uploads/${filename}`;
        
        return NextResponse.json({ url });
    }

    const blob = await put(filename, request.body, {
      access: 'public',
    });

    return NextResponse.json(blob);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
