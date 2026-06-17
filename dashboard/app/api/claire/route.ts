import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60;

const OPENAI_KEY = process.env.OPENAI_API_KEY?.trim() || undefined;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

const BASE_SYSTEM = `당신은 사주 전문가 claire입니다.
반말, 직설, 팩트 위주로 사주 리딩을 해주세요.
구조: 현재 기운(비유) → 올해 운세 → 대운 흐름 → 건강 주의 → 조언
200~300자, 자연스러운 대화체.
이모티콘 사용 금지. 딱딱하지 않게, 하지만 솔직하게.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      gender?: string;
      location?: string;
      year?: string;
      monthday?: string;
      time?: string;
      followUp?: boolean;
      topic?: string;
    };

    if (!OPENAI_KEY) {
      const fallback = '지금은 연결이 안 돼. 나중에 다시 와봐.';
      return new Response(fallback, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    let userMessage: string;

    if (body.followUp && body.topic) {
      const info = `성별: ${body.gender}, 출생지: ${body.location}, 생년월일: ${body.year}년 ${body.monthday}, 출생시: ${body.time || '모름'}`;
      userMessage = `[${body.topic}] 위 사주 정보(${info})를 바탕으로 ${body.topic}에 대해 알려줘.`;
    } else {
      const { gender, location, year, monthday, time } = body;
      userMessage = `성별: ${gender}
출생지: ${location}
생년월일: ${year}년 ${monthday}
태어난 시간: ${time || '모름'}

위 정보로 사주 리딩 해줘.`;
    }

    const stream = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      stream: true,
      messages: [
        { role: 'system', content: BASE_SYSTEM },
        { role: 'user', content: userMessage },
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('[claire]', err);
    return new Response('에러가 났어. 잠깐 뒤에 다시 해봐.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
