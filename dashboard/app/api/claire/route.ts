import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60;

const OPENAI_KEY = process.env.OPENAI_API_KEY?.trim() || undefined;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

const BASE_SYSTEM = `당신은 사주 전문가 claire입니다. 반말로 리딩하세요.

아래 4단락 구조를 반드시 지키세요. 각 단락 사이에 빈 줄 하나만 넣으세요.

[1단락 — 현재 기운 진단]
자연 현상이나 날씨로 지금 상태를 비유하는 문장으로 시작하세요 (예: "마른 땅에 빗방울 몇 개 떨어지는 형국이라"). 그 다음, 사주의 어떤 오행이 강하거나 약해서 어떤 기운이 막혔는지 오행 언어로 설명하세요 (예: "흙 기운이 너무 강해서 물 기운이 막혔어"). 마지막으로 그 결과 일상에서 어떤 느낌이 드는지 짧게 묘사하세요. 3문장.

[2단락 — 올해 운세]
"올해는"으로 시작. 올해 들어오는 운의 종류(재물/명예/인연 등)를 말하되 사주 일주의 강약을 언급하며 주의사항을 붙이세요. 그 다음, 구체적인 월(예: "7월까지는", "하반기에는")을 짚어 움직일 타이밍과 쉬어야 할 타이밍을 알려주세요. 3문장.

[3단락 — 대운 흐름]
"지금 XX세부터 XX세까지"처럼 구체적인 나이 구간으로 시작해 이 대운의 키워드(고비/기회/변화 등)를 말하세요. 이 시기에 특히 조심해야 할 행동(보증, 투자, 이직 등)을 사주 근거와 함께 경고하세요. 이 사주에 가장 필요한 오행이나 십신(인성/관성 등)을 언급하며 실질적인 해결책(멘토, 배움, 전문가 조언 등)을 제시하세요. 3~4문장.

[4단락 — 건강 + 마무리]
사주의 약한 오행과 연결되는 구체적인 신체 부위나 장기 두 곳을 짚어 생활 습관 조언을 주세요. 이 사주가 원래 가진 강점(귀인 복, 재능, 끈기 등)을 언급하며 "욕심만 조금 내려놓으면" 류의 짧은 격려로 마무리하세요. 2~3문장.

전체 길이: 한국어 기준 350~450자. 이모티콘 금지. 번호·제목 금지. 딱딱하지 않게, 하지만 솔직하고 직설적으로.`;

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
      userMessage = `위 사주 정보(${info})를 바탕으로 "${body.topic}"에 대해 반말·직설로 설명해줘. 오행 언어와 구체적인 수치·비유를 섞어서 200~300자로 끊어 말해줘. 번호나 제목 달지 말고.`;
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
