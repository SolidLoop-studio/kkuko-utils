import { NextRequest, NextResponse } from 'next/server';

type RankingResponse = {
    target: string;
    data: {
        id: string;
        rank: number;
        score: number;
        nick: string;
        diff: string;
    }[];
};

export async function GET(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id');
        
        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ error: 'Invalid ranking ID' }, { status: 400 });
        }

        const res = await fetch(`https://kkutu.co.kr/o/ranking?id=${id}`, {
            next: { revalidate: 300 } 
        });

        if (!res.ok) throw new Error('Network response was not ok');

        const data: RankingResponse = await res.json();
        const rankingData = data.data.find(user => user.id === id);

        if (!rankingData) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ 
            rank: rankingData.rank + 1, 
            id: rankingData.id 
        });

    } catch {
        return NextResponse.json(
            { error: 'Failed to fetch ranking data' },
            { status: 500 }
        );
    }
}