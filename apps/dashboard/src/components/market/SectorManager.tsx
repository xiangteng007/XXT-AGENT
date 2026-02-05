'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Plus,
    Pencil,
    Trash2,
    X,
    Settings2,
    RotateCcw,
} from 'lucide-react';
import type { CustomSector, StockItem } from '@/lib/market/sectorStore';

interface SectorManagerProps {
    sectors: CustomSector[];
    onAddSector: (name: string, stocks: StockItem[]) => void;
    onEditSector: (id: string, updates: { name?: string; stocks?: StockItem[] }) => void;
    onDeleteSector: (id: string) => void;
    onReset: () => void;
}

export function SectorManager({
    sectors,
    onAddSector,
    onEditSector,
    onDeleteSector,
    onReset,
}: SectorManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingSector, setEditingSector] = useState<CustomSector | null>(null);
    const [newSectorName, setNewSectorName] = useState('');
    const [newStockSymbol, setNewStockSymbol] = useState('');
    const [newStockName, setNewStockName] = useState('');
    const [editStocks, setEditStocks] = useState<StockItem[]>([]);

    const handleAddSector = () => {
        if (!newSectorName.trim()) return;
        onAddSector(newSectorName.trim(), []);
        setNewSectorName('');
    };

    const openEditDialog = (sector: CustomSector) => {
        setEditingSector(sector);
        setEditStocks([...sector.stocks]);
    };

    const closeEditDialog = () => {
        setEditingSector(null);
        setEditStocks([]);
        setNewStockSymbol('');
        setNewStockName('');
    };

    const handleSaveEdit = () => {
        if (!editingSector) return;
        onEditSector(editingSector.id, { stocks: editStocks });
        closeEditDialog();
    };

    const handleUpdateSectorName = (id: string, name: string) => {
        onEditSector(id, { name });
    };

    const addStockToEdit = () => {
        if (!newStockSymbol.trim()) return;
        const symbol = newStockSymbol.trim().toUpperCase();
        if (editStocks.some(s => s.symbol === symbol)) return;

        setEditStocks([...editStocks, {
            symbol,
            name: newStockName.trim() || symbol,
        }]);
        setNewStockSymbol('');
        setNewStockName('');
    };

    const removeStockFromEdit = (symbol: string) => {
        setEditStocks(editStocks.filter(s => s.symbol !== symbol));
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Settings2 className="h-4 w-4 mr-2" />
                        管理版塊
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>版塊管理</DialogTitle>
                    </DialogHeader>

                    {/* 新增版塊 */}
                    <div className="flex gap-2 mb-4">
                        <Input
                            placeholder="新版塊名稱"
                            value={newSectorName}
                            onChange={(e) => setNewSectorName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSector()}
                        />
                        <Button onClick={handleAddSector} disabled={!newSectorName.trim()}>
                            <Plus className="h-4 w-4 mr-1" />
                            新增
                        </Button>
                    </div>

                    {/* 版塊列表 */}
                    <div className="space-y-3">
                        {sectors.map((sector) => (
                            <Card key={sector.id}>
                                <CardHeader className="py-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">{sector.name}</CardTitle>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEditDialog(sector)}
                                                title="編輯股票"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onDeleteSector(sector.id)}
                                                className="text-red-600 hover:text-red-700"
                                                title="刪除版塊"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="py-2">
                                    <div className="flex flex-wrap gap-1">
                                        {sector.stocks.map((stock) => (
                                            <Badge key={stock.symbol} variant="secondary">
                                                {stock.symbol}
                                            </Badge>
                                        ))}
                                        {sector.stocks.length === 0 && (
                                            <span className="text-sm text-muted-foreground">
                                                尚無股票，點擊編輯新增
                                            </span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={onReset}>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            重置為預設
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 編輯股票對話框 */}
            <Dialog open={!!editingSector} onOpenChange={() => closeEditDialog()}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>編輯 {editingSector?.name} 股票</DialogTitle>
                    </DialogHeader>

                    {/* 新增股票 */}
                    <div className="space-y-2">
                        <Label>新增股票</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="代碼 (如 AAPL)"
                                value={newStockSymbol}
                                onChange={(e) => setNewStockSymbol(e.target.value.toUpperCase())}
                                className="w-32"
                            />
                            <Input
                                placeholder="名稱 (選填)"
                                value={newStockName}
                                onChange={(e) => setNewStockName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addStockToEdit()}
                            />
                            <Button onClick={addStockToEdit} disabled={!newStockSymbol.trim()}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* 股票列表 */}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        <Label>已加入股票 ({editStocks.length})</Label>
                        <div className="space-y-1">
                            {editStocks.map((stock) => (
                                <div
                                    key={stock.symbol}
                                    className="flex items-center justify-between p-2 bg-muted rounded"
                                >
                                    <div>
                                        <span className="font-medium">{stock.symbol}</span>
                                        <span className="text-muted-foreground ml-2">
                                            {stock.name}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeStockFromEdit(stock.symbol)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            {editStocks.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    尚無股票
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeEditDialog}>
                            取消
                        </Button>
                        <Button onClick={handleSaveEdit}>
                            儲存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
