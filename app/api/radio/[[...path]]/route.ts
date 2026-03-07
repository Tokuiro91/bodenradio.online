import { NextResponse } from 'next/server';

const RADIO_BACKEND = 'http://127.0.0.1:8080/api';

async function proxyRequest(req: Request, context: any) {
    const params = await context.params;
    const pathSegments = params.path || [];
    const path = pathSegments.join('/') || '';

    const url = new URL(req.url);
    const search = url.search;

    const targetUrl = `${RADIO_BACKEND}/${path}${search}`;

    const headers = new Headers();
    req.headers.forEach((value, key) => {
        const k = key.toLowerCase();
        if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(k)) {
            headers.set(key, value);
        }
    });

    try {
        let body: any = undefined;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            body = await req.arrayBuffer();
        }

        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            body: body,
            cache: 'no-store'
        });

        const data = await response.arrayBuffer();

        const responseHeaders = new Headers();
        response.headers.forEach((value, key) => {
            const k = key.toLowerCase();
            if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) {
                responseHeaders.set(key, value);
            }
        });

        return new NextResponse(data, {
            status: response.status,
            headers: responseHeaders
        });
    } catch (error) {
        console.error('Radio Proxy Error:', error);
        return NextResponse.json({ error: 'Radio backend unavailable' }, { status: 502 });
    }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const DELETE = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
