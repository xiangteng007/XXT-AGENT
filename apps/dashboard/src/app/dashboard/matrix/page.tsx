import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AgentMatrixPage() {
  return (
    <div className="min-h-screen bg-[#F9F9F9] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-end pb-8 border-b border-gray-200">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900 font-['Outfit']">A2A 協作矩陣中心</h1>
            <p className="text-slate-500 mt-2">即時監控智慧代理人之間的交叉詰問與邏輯推演。</p>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="text-blue-600 border-blue-200 bg-blue-50/50" asChild>
              <a href="/intelligence" target="_blank" rel="noopener noreferrer">開啟全域情報戰情室 (Argus)</a>
            </Button>
            <Button>部署新任務</Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex justify-between">
                <span>Argus (情報/雷達)</span>
                <span className="text-purple-600 text-sm font-normal px-3 py-1 bg-purple-100 rounded-full">監控中</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">擷取全球原物料與氣候災害即時警報中。</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex justify-between">
                <span>Titan (工程結構)</span>
                <span className="text-[#D4AF37] text-sm font-normal px-3 py-1 bg-[#D4AF37]/10 rounded-full">思考中</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">正在處理 7G 區域的藍圖提取...</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex justify-between">
                <span>Lumi (空間設計)</span>
                <span className="text-green-600 text-sm font-normal px-3 py-1 bg-green-100 rounded-full">閒置</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">等待 Titan 提供結構極限數據。</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex justify-between">
                <span>Rusty (計量計價)</span>
                <span className="text-blue-600 text-sm font-normal px-3 py-1 bg-blue-100 rounded-full">審計中</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">交叉比對鈦合金等級材料的市場價格。</p>
            </CardContent>
          </Card>
        </div>

        {/* Matrix Thread Example */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-slate-800 mb-6">交叉詰問執行序列</h2>
          <div className="space-y-6 border-l-2 border-[#D4AF37]/30 pl-8 relative">
            <Card className="relative">
              <div className="absolute -left-12 top-6 w-4 h-4 rounded-full bg-purple-500 shadow-[0_0_10px_#A855F7]" />
              <CardContent className="pt-6">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2 block">Argus • 14:01 UTC</span>
                <p className="text-slate-700">警告：偵測到智利銅礦罷工事件，引發 LME 銅價上漲預期信號。已通報 Rusty 預作儲備與報價調整。</p>
              </CardContent>
            </Card>
            <Card className="relative">
              <div className="absolute -left-12 top-6 w-4 h-4 rounded-full bg-[#D4AF37] shadow-[0_0_10px_#D4AF37]" />
              <CardContent className="pt-6">
                <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-2 block">Titan • 14:02 UTC</span>
                <p className="text-slate-700">收到情報。經計算，結構完整性要求至少需要 4 根增強支柱（材料：銅合金/鋼材混合）。</p>
              </CardContent>
            </Card>
            <Card className="relative">
              <div className="absolute -left-12 top-6 w-4 h-4 rounded-full bg-slate-300" />
              <CardContent className="pt-6">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Rusty • 14:03 UTC</span>
                <p className="text-slate-700">增加 4 根支柱將超出目前預算限制 12%。已請求 Lumi 評估縮減空間佈局以作補償。</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
