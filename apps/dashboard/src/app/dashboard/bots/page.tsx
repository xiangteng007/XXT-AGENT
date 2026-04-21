import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BotIntegrationPage() {
  return (
    <div className="min-h-screen bg-[#F9F9F9] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-end pb-8 border-b border-gray-200">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900 font-['Outfit']">雙頻機器人控制中心</h1>
            <p className="text-slate-500 mt-2">管理 Telegram 與 LINE 的雙向通訊節點。</p>
          </div>
          <Button>新增 Webhook</Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Telegram Bot */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -mr-16 -mt-16" />
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">TG</div>
                  @SENTENGMAIN_BOT
                </CardTitle>
                <span className="badge badge-success">上線 (輪詢中)</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <div className="text-sm text-slate-500 mb-1">訊息數量 (24h)</div>
                  <div className="text-2xl font-semibold text-slate-900">1,244</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <div className="text-sm text-slate-500 mb-1">活躍使用者</div>
                  <div className="text-2xl font-semibold text-slate-900">42</div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Webhook 配置</h4>
                <div className="bg-slate-900 rounded-lg p-3 text-slate-300 font-mono text-sm border border-slate-800 break-all">
                  https://api.senteng.com/v1/webhook/telegram/alpha-node
                </div>
              </div>
              
              <div className="pt-4 flex gap-3">
                <Button variant="outline" className="w-full">重啟輪詢器</Button>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-none">廣播警告</Button>
              </div>
            </CardContent>
          </Card>

          {/* LINE Bot */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-bl-full -mr-16 -mt-16" />
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#06C755] flex items-center justify-center text-white font-bold text-sm">LN</div>
                  @XXT_Field_Ops
                </CardTitle>
                <span className="badge badge-success">上線 (Webhook)</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <div className="text-sm text-slate-500 mb-1">訊息數量 (24h)</div>
                  <div className="text-2xl font-semibold text-slate-900">892</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <div className="text-sm text-slate-500 mb-1">活躍使用者</div>
                  <div className="text-2xl font-semibold text-slate-900">18</div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Webhook 配置</h4>
                <div className="bg-slate-900 rounded-lg p-3 text-slate-300 font-mono text-sm border border-slate-800 break-all">
                  https://api.senteng.com/v1/webhook/line/field-node
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button variant="outline" className="w-full">測試簽章</Button>
                <Button className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white shadow-none">發送圖文選單</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
