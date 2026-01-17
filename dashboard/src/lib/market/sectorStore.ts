/**
 * Sector Store - 版塊資料管理
 * 支援自訂版塊的 CRUD 操作與持久化
 */

export interface StockItem {
    symbol: string;
    name: string;
}

export interface CustomSector {
    id: string;
    name: string;
    stocks: StockItem[];
    createdAt: string;
    updatedAt: string;
}

const STORAGE_KEY = 'xxt-custom-sectors';

// 預設版塊
const DEFAULT_SECTORS: CustomSector[] = [
    {
        id: 'tech',
        name: '科技',
        stocks: [
            { symbol: 'AAPL', name: 'Apple' },
            { symbol: 'MSFT', name: 'Microsoft' },
            { symbol: 'GOOG', name: 'Alphabet' },
            { symbol: 'NVDA', name: 'NVIDIA' },
            { symbol: 'META', name: 'Meta' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'finance',
        name: '金融',
        stocks: [
            { symbol: 'JPM', name: 'JPMorgan' },
            { symbol: 'BAC', name: 'Bank of America' },
            { symbol: 'GS', name: 'Goldman Sachs' },
            { symbol: 'V', name: 'Visa' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'healthcare',
        name: '醫療',
        stocks: [
            { symbol: 'JNJ', name: 'Johnson & Johnson' },
            { symbol: 'UNH', name: 'UnitedHealth' },
            { symbol: 'PFE', name: 'Pfizer' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'energy',
        name: '能源',
        stocks: [
            { symbol: 'XOM', name: 'ExxonMobil' },
            { symbol: 'CVX', name: 'Chevron' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

// ============ Storage Functions ============

export function loadSectors(): CustomSector[] {
    if (typeof window === 'undefined') {
        return DEFAULT_SECTORS;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load sectors:', e);
    }

    // 初始化預設資料
    saveSectors(DEFAULT_SECTORS);
    return DEFAULT_SECTORS;
}

export function saveSectors(sectors: CustomSector[]): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sectors));
    } catch (e) {
        console.error('Failed to save sectors:', e);
    }
}

// ============ CRUD Operations ============

export function createSector(name: string, stocks: StockItem[] = []): CustomSector {
    const sectors = loadSectors();

    const newSector: CustomSector = {
        id: `sector-${Date.now()}`,
        name,
        stocks,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    sectors.push(newSector);
    saveSectors(sectors);

    return newSector;
}

export function updateSector(id: string, updates: Partial<Pick<CustomSector, 'name' | 'stocks'>>): CustomSector | null {
    const sectors = loadSectors();
    const index = sectors.findIndex(s => s.id === id);

    if (index === -1) return null;

    sectors[index] = {
        ...sectors[index],
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    saveSectors(sectors);
    return sectors[index];
}

export function deleteSector(id: string): boolean {
    const sectors = loadSectors();
    const filtered = sectors.filter(s => s.id !== id);

    if (filtered.length === sectors.length) return false;

    saveSectors(filtered);
    return true;
}

export function addStockToSector(sectorId: string, stock: StockItem): boolean {
    const sectors = loadSectors();
    const sector = sectors.find(s => s.id === sectorId);

    if (!sector) return false;

    // 避免重複
    if (sector.stocks.some(s => s.symbol === stock.symbol)) return false;

    sector.stocks.push(stock);
    sector.updatedAt = new Date().toISOString();

    saveSectors(sectors);
    return true;
}

export function removeStockFromSector(sectorId: string, symbol: string): boolean {
    const sectors = loadSectors();
    const sector = sectors.find(s => s.id === sectorId);

    if (!sector) return false;

    const originalLength = sector.stocks.length;
    sector.stocks = sector.stocks.filter(s => s.symbol !== symbol);

    if (sector.stocks.length === originalLength) return false;

    sector.updatedAt = new Date().toISOString();
    saveSectors(sectors);
    return true;
}

export function resetToDefaults(): void {
    saveSectors(DEFAULT_SECTORS);
}

// ============ Hook ============

import { useState, useEffect, useCallback } from 'react';

export function useSectorStore() {
    const [sectors, setSectors] = useState<CustomSector[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setSectors(loadSectors());
        setIsLoading(false);
    }, []);

    const refresh = useCallback(() => {
        setSectors(loadSectors());
    }, []);

    const addSector = useCallback((name: string, stocks: StockItem[] = []) => {
        const newSector = createSector(name, stocks);
        setSectors(prev => [...prev, newSector]);
        return newSector;
    }, []);

    const editSector = useCallback((id: string, updates: Partial<Pick<CustomSector, 'name' | 'stocks'>>) => {
        const updated = updateSector(id, updates);
        if (updated) {
            setSectors(loadSectors());
        }
        return updated;
    }, []);

    const removeSector = useCallback((id: string) => {
        const result = deleteSector(id);
        if (result) {
            setSectors(prev => prev.filter(s => s.id !== id));
        }
        return result;
    }, []);

    const addStock = useCallback((sectorId: string, stock: StockItem) => {
        const result = addStockToSector(sectorId, stock);
        if (result) {
            setSectors(loadSectors());
        }
        return result;
    }, []);

    const removeStock = useCallback((sectorId: string, symbol: string) => {
        const result = removeStockFromSector(sectorId, symbol);
        if (result) {
            setSectors(loadSectors());
        }
        return result;
    }, []);

    const reset = useCallback(() => {
        resetToDefaults();
        setSectors(DEFAULT_SECTORS);
    }, []);

    return {
        sectors,
        isLoading,
        refresh,
        addSector,
        editSector,
        removeSector,
        addStock,
        removeStock,
        reset,
    };
}
