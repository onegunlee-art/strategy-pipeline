// DB의 label_overrides를 읽어 SUB_FACTORS / PILLAR_META 위에 머지
import { getDb } from './db';
import { SUB_FACTORS, PILLAR_META, SubFactorMeta, PillarId } from './pillars';

export interface MergedSubFactor extends SubFactorMeta {
  label: string;
  description: string;
}

export interface MergedPillarMeta {
  label: string;
  description: string;
  defaultWeight: number;
}

export interface Labels {
  subFactors: MergedSubFactor[];
  pillars: Record<PillarId, MergedPillarMeta>;
}

export async function getLabels(): Promise<Labels> {
  try {
    const db = await getDb();
    const { rows } = await db.query(
      'SELECT scope, key, field, value FROM label_overrides'
    );

    const overrides: Record<string, string> = {};
    for (const r of rows) {
      overrides[`${r.scope}:${r.key}:${r.field}`] = r.value;
    }

    const subFactors: MergedSubFactor[] = SUB_FACTORS.map(f => ({
      ...f,
      label: overrides[`sub_factor:${f.id}:label`] ?? f.label,
      description: overrides[`sub_factor:${f.id}:description`] ?? f.description,
    }));

    const pillars = Object.fromEntries(
      (Object.entries(PILLAR_META) as [PillarId, typeof PILLAR_META[PillarId]][]).map(([id, meta]) => [
        id,
        {
          ...meta,
          label: overrides[`pillar:${id}:label`] ?? meta.label,
          description: overrides[`pillar:${id}:description`] ?? meta.description,
        },
      ])
    ) as Record<PillarId, MergedPillarMeta>;

    return { subFactors, pillars };
  } catch {
    // DB 연결 실패 시 코드 기본값 사용
    return {
      subFactors: SUB_FACTORS.map(f => ({ ...f })),
      pillars: Object.fromEntries(
        (Object.entries(PILLAR_META) as [PillarId, typeof PILLAR_META[PillarId]][]).map(([id, meta]) => [id, { ...meta }])
      ) as Record<PillarId, MergedPillarMeta>,
    };
  }
}
