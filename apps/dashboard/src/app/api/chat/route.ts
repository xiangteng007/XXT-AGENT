import { NextResponse } from 'next/server';

// Mock responses for each agent to give them some personality
const MOCK_RESPONSES: Record<string, string[]> = {
  argus: [
    "Analyzing cross-dimensional data streams...",
    "Intelligence gathered. Anomaly detected in sector 7G.",
    "Memory synthesis complete. Awaiting further directives."
  ],
  lumi: [
    "I've visualized the spatial layout. The flow is optimal.",
    "Adjusting ambient lighting parameters for maximum productivity.",
    "The aesthetic parameters have been locked in."
  ],
  nova: [
    "Task assignment synchronized across all available units.",
    "HR protocol initiated. Evaluating agent efficiency metrics.",
    "I'll coordinate with Titan and Rusty for the next phase."
  ],
  rusty: [
    "Calculating procurement costs... Margin is within acceptable limits.",
    "General ledger updated. I've flagged a discrepancy in Q3 projections.",
    "Financial report generated and securely encrypted."
  ],
  titan: [
    "Structural integrity is at 100%. Ready for heavy loads.",
    "BIM analysis complete. No clash detected in the HVAC system.",
    "Engineering calculations verified. Proceeding with constructability review."
  ]
};

export async function POST(req: Request) {
  try {
    const { agentId, message } = await req.json();

    if (!agentId || !message) {
      return NextResponse.json({ error: 'Missing agentId or message' }, { status: 400 });
    }

    // Simulate network latency (between 1s to 2s)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    // Get a random response based on the agent's personality
    const responses = MOCK_RESPONSES[agentId] || [
      "Message received. Processing...",
      "Understood. Initiating protocol.",
      "Awaiting further data to execute."
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    // If the user says something specific, we can add a hardcoded reply
    let finalResponse = randomResponse;
    if (message.toLowerCase().includes('status')) {
      finalResponse = "All systems nominal. Operational efficiency at 99.8%.";
    }

    return NextResponse.json({ message: finalResponse });
    
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
