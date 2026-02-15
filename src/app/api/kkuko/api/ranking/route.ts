import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

type RankingResponse = {
    target: string;
    data: {
        id: string,
        rank: number,
        score: number,
        nick: string
        diff: string
    }[]
};

export async function GET(request: NextRequest){
    try {
        const id = request.nextUrl.searchParams.get('id');
        if (!id || isNaN(Number(id))){
            return NextResponse.json(
                { error: 'Invalid ranking ID' },
                { status: 400 }
            );
        }
        const res = await axios.get<RankingResponse>(`https://kkutu.co.kr/o/ranking?id=${id}`);
        const rankingData = res.data.data.find(user => user.id === id);
        if (!rankingData) {
            return NextResponse.json(
                { error: 'User not found in ranking data' },
                { status: 404 }
            );
        } else {
            return NextResponse.json({rank: rankingData.rank + 1, id: rankingData.id});
        }
    } catch {
        return NextResponse.json(
            { error: 'Failed to fetch ranking data' },
            { status: 500 }
        );
    }
}