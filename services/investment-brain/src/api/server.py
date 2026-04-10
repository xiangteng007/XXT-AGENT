import asyncio
import json
import logging
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage

# Internal imports
from src.graph.supervisor import investment_graph

logger = logging.getLogger("investment-brain.api.server")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="XXT-AGENT Investment Brain",
    description="LangGraph Backend for OpenClaw Core",
    version="1.0.0"
)


def _serialize_message(msg):
    """Helper to serialize LangChain messages for JSON."""
    if isinstance(msg, AIMessage):
        return {"role": "assistant", "content": msg.content, "name": msg.name}
    if hasattr(msg, "content"):
        return {"role": "unknown", "content": msg.content}
    return str(msg)


@app.post("/api/v1/tasks/stream")
async def execute_task_stream(request: Request):
    """
    Execute a LangGraph task and stream the events back using Server-Sent Events (SSE).
    This allows the Node.js OpenClaw Gateway to push real-time status updates to the UI.
    """
    body = await request.json()
    symbol = body.get("symbol", "AAPL")
    task_id = body.get("task_id", "task_unknown")

    logger.info(f"Starting LangGraph run for {symbol} (Task {task_id})")

    async def event_generator() -> AsyncGenerator[str, None]:
        # Provide the initial state
        initial_state = {
            "symbol": symbol,
            "portfolio": {
                "balance": 100000.0,
                "holdings": {},
                "daily_pnl_pct": 0.0,
                "max_drawdown": 0.0,
            },
            "investment_plan": None,
            "risk_assessment": None,
            "execution_status": "pending",
            "trade_results": [],
            "messages": [],
            "current_step": "analyze",
            "iteration": 0,
            "metadata": {"task_id": task_id},
        }

        # Stream LangGraph state updates
        try:
            async for output in investment_graph.astream(initial_state, stream_mode="updates"):
                # output format: { "node_name": { ...state_diff... } }
                for node_name, state_diff in output.items():
                    # Extract any new messages (Thoughts)
                    messages = state_diff.get("messages", [])
                    serialized_msgs = [_serialize_message(m) for m in messages]
                    
                    # Extract risk_assessment or plan status
                    current_step = state_diff.get("current_step", "unknown")
                    
                    # Build SSE payload
                    payload = {
                        "event": "NODE_UPDATE",
                        "node": node_name,
                        "current_step": current_step,
                        "messages": serialized_msgs,
                        "task_id": task_id
                    }
                    
                    yield f"data: {json.dumps(payload, default=str)}\n\n"
                    
                    # Add a small delay for UI animation visual pacing
                    await asyncio.sleep(0.5)
                    
            # Send completion event
            yield f"data: {json.dumps({'event': 'TASK_COMPLETE', 'task_id': task_id})}\n\n"
        except Exception as e:
            logger.error(f"Graph execution error: {e}")
            yield f"data: {json.dumps({'event': 'ERROR', 'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    uvicorn.run("src.api.server:app", host="0.0.0.0", port=8090, reload=True)
