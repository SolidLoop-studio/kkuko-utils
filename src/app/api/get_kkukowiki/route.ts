import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get('title');

    if (!title) {
        return NextResponse.json({ error: 'title 쿼리 파라미터가 필요합니다.' }, { status: 400 });
    }

    const encodedTitle = encodeURIComponent(title);
    const targetUrl = `https://kkukowiki.kr/index.php?title=${encodedTitle}`;

    try {
        await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                'Accept-Language': 'ko-KR,ko;q=0.9',
                'Referer': 'https://kkukowiki.kr/',
            }
        });

        return new NextResponse("ok");

    } catch {
        return NextResponse.json({ error: '' }, { status: 404 });
    }
}