"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TaxPlanResponse {
  ok: boolean;
  year: number;
  data_summary: any;
  plan: any;
  disclaimer: string;
}

export function TaxPlanner() {
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState<TaxPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTaxPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the actual gateway URL or relative API route. 
      // Assuming localhost:3100 for local dev based on the openclaw-gateway config.
      const res = await fetch("http://localhost:3100/agents/accountant/taxplan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ year: 2026 }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch tax plan");
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setPlanData(data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const formatPlanToMarkdown = (plan: any): string => {
    if (typeof plan === "string") return plan;
    
    try {
      let md = "";
      if (Array.isArray(plan?.entities_analysis)) {
        md += "### 📊 各實體稅務概況\n";
        plan.entities_analysis.forEach((item: any) => { md += `- ${typeof item === 'string' ? item : JSON.stringify(item)}\n`; });
        md += "\n";
      }
      if (Array.isArray(plan?.opportunities)) {
        md += "### 💡 節稅機會\n";
        plan.opportunities.forEach((item: any) => { md += `- ${typeof item === 'string' ? item : JSON.stringify(item)}\n`; });
        md += "\n";
      }
      if (Array.isArray(plan?.risks)) {
        md += "### ⚠️ 風險警示\n";
        plan.risks.forEach((item: any) => { md += `- ${typeof item === 'string' ? item : JSON.stringify(item)}\n`; });
        md += "\n";
      }
      if (Array.isArray(plan?.action_plan)) {
        md += "### 📅 行動計劃\n";
        plan.action_plan.forEach((item: any) => { md += `- ${typeof item === 'string' ? item : JSON.stringify(item)}\n`; });
        md += "\n";
      }
      
      return md.trim() ? md : ("```json\n" + JSON.stringify(plan, null, 2) + "\n```");
    } catch (e) {
      return "```json\n" + JSON.stringify(plan, null, 2) + "\n```";
    }
  };

  return (
    <Card className="mt-8 border-slate-200 shadow-sm">
      <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl font-semibold text-slate-800">AI 節稅規劃 (Tax Planner)</CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            整合各實體收支資料與最新稅務法規，產生最佳化節稅策略。
          </p>
        </div>
        <Button onClick={fetchTaxPlan} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
          {loading ? "計算中..." : "產生節稅報告"}
        </Button>
      </CardHeader>
      <CardContent className="p-6">
        {error && <div className="p-4 bg-red-50 text-red-600 rounded-md mb-4 border border-red-200">{error}</div>}
        
        {!planData && !loading && !error && (
          <div className="text-center py-12 text-slate-400">
            點擊上方按鈕開始進行 AI 節稅計算
          </div>
        )}

        {loading && (
          <div className="text-center py-12 text-slate-500 animate-pulse">
            鳴鑫會計師正在分析帳本與法規，請稍候...
          </div>
        )}

        {planData && !loading && planData.plan && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200 prose prose-slate max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {formatPlanToMarkdown(planData.plan)}
              </ReactMarkdown>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
              {planData.disclaimer || "以上建議依帳本資料自動生成，申報前請與稅務機關確認，不構成法律意見。"}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
