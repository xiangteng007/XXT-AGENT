import json
import os
import sys
from pathlib import Path

from pydantic import TypeAdapter

# Add src to sys.path so we can import from graph.state
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from graph.state import (
    PriceSnapshot,
    FusionContext,
    MarketInsight,
    VerificationInsight,
    InvestmentAction,
    InvestmentPlan,
    RiskAssessment,
    InvestmentAgentState
)

# We define a wrapper Pydantic model to generate schema for all models at once
from pydantic import BaseModel

class StateModels(BaseModel):
    price_snapshot: PriceSnapshot
    fusion_context: FusionContext
    market_insight: MarketInsight
    verification_insight: VerificationInsight
    investment_action: InvestmentAction
    investment_plan: InvestmentPlan
    risk_assessment: RiskAssessment
    # InvestmentAgentState has BaseMessage fields which are hard to serialize for pure JSON schema without custom encoders,
    # so we might skip it or only include the domain models.

def main():
    # Export the JSON schema
    schema = StateModels.model_json_schema()
    
    # Write to a file in the project root or specifically for the dashboard to pick up
    output_dir = Path(__file__).parent.parent.parent.parent / "apps" / "dashboard" / "scripts"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    schema_path = output_dir / "investment_brain_schema.json"
    
    with open(schema_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2)
        
    print(f"Schema written to {schema_path}")

if __name__ == "__main__":
    main()
