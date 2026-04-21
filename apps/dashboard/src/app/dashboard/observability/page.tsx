import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ObservabilityPage() {
  return (
    <div className="min-h-screen bg-[#F9F9F9] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-end pb-8 border-b border-gray-200">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900 font-['Outfit']">全域系統監控台</h1>
            <p className="text-slate-500 mt-2">即時遙測、OpenClaw 閘道器健康度與大型語言模型 Token 消耗量。</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">清除快取</Button>
          </div>
        </header>

        {/* Global Status Banner */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="font-medium text-green-800">所有系統運作正常</span>
          </div>
          <span className="text-sm text-green-700">上次異常：14 天前</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">API 延迟</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">42ms</div>
              <div className="w-full bg-gray-100 h-1 mt-3 rounded-full overflow-hidden">
                <div className="bg-green-500 w-[20%] h-full rounded-full" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Gemini Pro 消耗量 (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">1.24M</div>
              <div className="w-full bg-gray-100 h-1 mt-3 rounded-full overflow-hidden">
                <div className="bg-[#D4AF37] w-[65%] h-full rounded-full" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Claude 3.5 Sonnet 消耗量 (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">840K</div>
              <div className="w-full bg-gray-100 h-1 mt-3 rounded-full overflow-hidden">
                <div className="bg-[#D4AF37] w-[45%] h-full rounded-full" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">記憶體圖形節點數</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">14,208</div>
              <p className="text-xs text-slate-500 mt-1">向量資料庫：健康</p>
            </CardContent>
          </Card>
        </div>

        {/* Live Logs */}
        <Card className="bg-slate-900 text-slate-300 border-slate-800">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="text-lg text-slate-100">即時閘道器紀錄</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-sm pt-4 space-y-2 h-[300px] overflow-y-auto">
            <div className="flex gap-4">
              <span className="text-slate-500">10:45:01</span>
              <span className="text-blue-400">[INFO]</span>
              <span>OpenClaw 閘道器已接收來自 Telegram Bot 的資料負載。</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-500">10:45:02</span>
              <span className="text-purple-400">[ROUTER]</span>
              <span>正在將意圖分派給代理人「Lumi」。上下文範圍：4K tokens。</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-500">10:45:04</span>
              <span className="text-green-400">[SUCCESS]</span>
              <span>Lumi 於 1.4秒內回應。動作：「更新空間資料庫」。</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-500">10:45:10</span>
              <span className="text-yellow-400">[WARN]</span>
              <span>IP 192.168.1.135 接近速率限制閾值 (45/50)。</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
