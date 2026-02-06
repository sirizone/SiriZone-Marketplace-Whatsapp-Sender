import { NextResponse } from 'next/server';

const WORKER_URL = process.env.WORKER_URL || 'http://127.0.0.1:3001';
const WORKER_API_KEY = process.env.WORKER_API_KEY;

async function proxyRequest(request: Request, { params }: { params: { slug: string[] } }) {
  const path = (await params).slug.join('/');
  const url = `${WORKER_URL}/api/${path}`;
  
  try {
    const body = request.method !== 'GET' ? await request.json() : undefined;

    const response = await fetch(url, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WORKER_API_KEY || '',
        'ngrok-skip-browser-warning': 'true',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: 'Worker unreachable' }, { status: 502 });
  }
}

export async function GET(req: Request, context: any) {
  return proxyRequest(req, context);
}

export async function POST(req: Request, context: any) {
  return proxyRequest(req, context);
}

export async function DELETE(req: Request, context: any) {
  return proxyRequest(req, context);
}
