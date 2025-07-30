// app/api/surveys/route.ts
import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

export interface SurveySubmission {
  id: number;
  name: string;
  age: number;
  coffeeName: string;
  flavors: Array<{
    category: string;
    subcategory: string;
    flavor: string;
  }>;
  timestamp: string;
  rawTimestamp: string;
}

// GET: アンケート結果を取得
export async function GET() {
  try {
    // KVから全ての回答を取得（最新100件）
    const submissions = await kv.lrange('coffee-surveys', 0, 99);
    
    // 文字列をオブジェクトに変換
    const parsedSubmissions = submissions.map(item => 
      typeof item === 'string' ? JSON.parse(item) : item
    );

    return NextResponse.json({
      success: true,
      data: parsedSubmissions,
      count: parsedSubmissions.length
    });
  } catch (error) {
    console.error('Survey fetch error:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return NextResponse.json(
      { success: false, error: `Failed to fetch surveys: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// POST: 新しいアンケートを保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received request body:', body);
    const { name, age, coffeeName, flavors } = body;

    if (!name || !age || !coffeeName || !flavors || !Array.isArray(flavors)) {
      return NextResponse.json(
        { success: false, error: 'Invalid data format. Name, age, coffee name, and flavors are required.' },
        { status: 400 }
      );
    }

    // 年齢のバリデーション
    const parsedAge = parseInt(age);
    if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      return NextResponse.json(
        { success: false, error: 'Age must be between 1 and 120' },
        { status: 400 }
      );
    }

    // 新しい回答を作成
    const submission: SurveySubmission = {
      id: Date.now(),
      name: name.trim(),
      age: parsedAge,
      coffeeName: coffeeName.trim(),
      flavors,
      timestamp: new Date().toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo'
      }),
      rawTimestamp: new Date().toISOString()
    };

    // KVに保存（リストの先頭に追加）
    await kv.lpush('coffee-surveys', JSON.stringify(submission));

    // 古いデータを削除（最新1000件のみ保持）
    await kv.ltrim('coffee-surveys', 0, 999);

    return NextResponse.json({
      success: true,
      data: submission,
      message: 'Survey saved successfully'
    });
  } catch (error) {
    console.error('Survey save error:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return NextResponse.json(
      { success: false, error: `Failed to save survey: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// DELETE: 全データを削除（管理者用）
export async function DELETE() {
  try {
    await kv.del('coffee-surveys');
    return NextResponse.json({
      success: true,
      message: 'All surveys deleted'
    });
  } catch (error) {
    console.error('Survey delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete surveys' },
      { status: 500 }
    );
  }
}
