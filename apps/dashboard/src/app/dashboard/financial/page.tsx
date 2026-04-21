import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { TaxPlanner } from "@/components/financial/TaxPlanner";

export default function FinancialConstructionPage() {
  return (
    <div className="min-h-screen bg-[#F9F9F9] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-end pb-8 border-b border-gray-200">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900 font-['Outfit']">財務與工程量化總帳</h1>
            <p className="text-slate-500 mt-2">即時成本估算、採購追蹤與結構合規性審查。</p>
          </div>
          <div className="flex gap-4">
            <Link href="/dashboard/financial/banking">
              <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50">Banking Dashboard →</Button>
            </Link>
            <Button variant="outline">匯出 CSV</Button>
            <Button>產生報表</Button>
          </div>
        </header>

        {/* High Level Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="card-gold">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">專案總預算</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">NT$ 45,200,000</div>
              <p className="text-xs text-green-600 mt-1">↑ 較基準值超支 2.1% (Rusty 財務分析)</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">結構安全極限</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">2.4x</div>
              <p className="text-xs text-green-600 mt-1">符合國家標準 CNS (Titan 驗證)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">採購項目進度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">128 / 145</div>
              <p className="text-xs text-slate-500 mt-1">88% 供應商已確認</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">空間坪效比</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">92%</div>
              <p className="text-xs text-slate-500 mt-1">實用面積佔比 (Lumi 最佳化)</p>
            </CardContent>
          </Card>
        </div>

        {/* Data Grid */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-white/50 border-b border-gray-100">
            <CardTitle className="text-lg">近期審計帳目</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>編號</th>
                  <th>部門</th>
                  <th>代理人</th>
                  <th>描述</th>
                  <th>金額</th>
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <tr className="border-b border-gray-50">
                  <td className="px-4 py-3 font-medium text-slate-900">PR-2026-041</td>
                  <td className="px-4 py-3 text-slate-500">結構部</td>
                  <td className="px-4 py-3"><span className="badge badge-warning">Titan</span></td>
                  <td className="px-4 py-3">A級鋼筋材料採購</td>
                  <td className="px-4 py-3 font-mono">NT$ 2,450,000</td>
                  <td className="px-4 py-3"><span className="badge badge-success">已核准</span></td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="px-4 py-3 font-medium text-slate-900">PR-2026-042</td>
                  <td className="px-4 py-3 text-slate-500">室內設計</td>
                  <td className="px-4 py-3"><span className="badge badge-info">Lumi</span></td>
                  <td className="px-4 py-3">大廳吸音牆面板</td>
                  <td className="px-4 py-3 font-mono">NT$ 320,000</td>
                  <td className="px-4 py-3"><span className="badge badge-gold">等待審查</span></td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="px-4 py-3 font-medium text-slate-900">AU-2026-018</td>
                  <td className="px-4 py-3 text-slate-500">財務部</td>
                  <td className="px-4 py-3"><span className="badge badge-gold">Rusty</span></td>
                  <td className="px-4 py-3">季末營業稅查帳異常標記</td>
                  <td className="px-4 py-3 font-mono text-red-500">NT$ -15,000</td>
                  <td className="px-4 py-3"><span className="badge badge-error">需要動作</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* AI Tax Planner */}
        <TaxPlanner />
      </div>
    </div>
  );
}
