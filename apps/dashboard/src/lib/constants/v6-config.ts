import { EntityType } from 'types';

export interface MascotConfig {
    id: string;
    animal: string;
    nameZh: string;
    description: string;
    colorHex: string;
    role: string;
}

export const V6_MASCOTS: Record<string, MascotConfig> = {
    accountant: { id: 'accountant', animal: 'Owl', nameZh: '貓頭鷹', role: '會計', description: '睿智與帳目精確', colorHex: '#EAB308' }, // gold
    finance: { id: 'finance', animal: 'Lion', nameZh: '獅子', role: '財務', description: '資金實力與威嚴', colorHex: '#F59E0B' }, // amber
    guardian: { id: 'guardian', animal: 'Bear', nameZh: '棕熊', role: '法務/保險', description: '堅如磐石的防護', colorHex: '#8B5CF6' }, // violet
    lex: { id: 'lex', animal: 'Fox', nameZh: '雪狐', role: '合約', description: '細節敏銳度', colorHex: '#38BDF8' }, // light blue
    scout: { id: 'scout', animal: 'Shiba', nameZh: '柴犬', role: '無人機/外勤', description: '高活動力與外勤探索', colorHex: '#F97316' }, // orange
    zora: { id: 'zora', animal: 'Sheep', nameZh: '綿羊', role: 'NGO/志工', description: '溫柔與社福照顧', colorHex: '#10B981' }, // emerald
    titan: { id: 'titan', animal: 'Elephant', nameZh: '大象', role: '建築/BIM', description: '穩固與大型工程', colorHex: '#64748B' }, // slate
    lumi: { id: 'lumi', animal: 'Cat', nameZh: '波斯貓', role: '室內設計', description: '美學與精緻品味', colorHex: '#EC4899' }, // pink
    rusty: { id: 'rusty', animal: 'Raccoon', nameZh: '浣熊', role: '估算/工務', description: '精打細算與物料掌控', colorHex: '#84CC16' }, // lime
};

export interface EntityConfig {
    id: EntityType;
    name: string;
    shortName: string;
    colorHex: string;
}

export const V6_ENTITIES: Record<EntityType, EntityConfig> = {
    personal: { id: 'personal', name: '李董個人', shortName: '個人', colorHex: '#A78BFA' }, // violet-400
    family: { id: 'family', name: '李氏家族', shortName: '家族', colorHex: '#F472B6' }, // pink-400
    co_drone: { id: 'co_drone', name: '天際線無人機', shortName: '無人機', colorHex: '#38BDF8' }, // sky-400
    co_construction: { id: 'co_construction', name: '鳴鑫營造', shortName: '營造', colorHex: '#FBBF24' }, // amber-400
    co_renovation: { id: 'co_renovation', name: '晨星室內裝修', shortName: '室裝', colorHex: '#34D399' }, // emerald-400
    co_design: { id: 'co_design', name: '晶藝空間設計', shortName: '設計', colorHex: '#60A5FA' }, // blue-400
    assoc_rescue: { id: 'assoc_rescue', name: '希望災難救援協會', shortName: '協會', colorHex: '#F87171' }, // red-400
};
