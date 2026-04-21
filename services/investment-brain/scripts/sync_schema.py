import json
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from pydantic import TypeAdapter

from src.graph.state import (
    PriceSnapshot,
    FusionContext,
    MarketInsight,
    VerificationInsight,
    InvestmentAction,
    InvestmentPlan,
    RiskAssessment,
    TradeResult,
    PortfolioState,
    StrategyMemory,
    InvestmentAgentState
)

def export_schema(type_def, name, out_dir):
    adapter = TypeAdapter(type_def)
    schema = adapter.json_schema()
    schema["title"] = name
    
    with open(os.path.join(out_dir, f"{name}.json"), "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)

def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "schemas")
    os.makedirs(out_dir, exist_ok=True)
    
    types_to_export = [
        (PriceSnapshot, "PriceSnapshot"),
        (FusionContext, "FusionContext"),
        (MarketInsight, "MarketInsight"),
        (VerificationInsight, "VerificationInsight"),
        (InvestmentAction, "InvestmentAction"),
        (InvestmentPlan, "InvestmentPlan"),
        (RiskAssessment, "RiskAssessment"),
        (TradeResult, "TradeResult"),
        (PortfolioState, "PortfolioState"),
        (StrategyMemory, "StrategyMemory"),
        (InvestmentAgentState, "InvestmentAgentState"),
    ]
    
    for type_def, name in types_to_export:
        export_schema(type_def, name, out_dir)
        
    print(f"Exported {len(types_to_export)} schemas to {os.path.abspath(out_dir)}")

if __name__ == "__main__":
    main()
