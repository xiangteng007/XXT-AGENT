import fs from 'fs';
import path from 'path';

// Simplified Runner.
// In actual execution, this would call HTTP endpoints of openclaw-gateway
// and record tokens, latency, and use an LLM call to score 1-5 for response quality.

const BENCHMARK_FILE = path.join(__dirname, '../tests/prompts/benchmark.json');
const REPORTS_DIR = path.join(__dirname, '../reports');

async function runBenchmark() {
    if (!fs.existsSync(BENCHMARK_FILE)) {
        console.error(`Benchmark file not found at ${BENCHMARK_FILE}`);
        return;
    }

    const testBank = JSON.parse(fs.readFileSync(BENCHMARK_FILE, 'utf-8'));
    const reportData: any = {
        date: new Date().toISOString(),
        results: {}
    };

    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }

    console.log("🚀 Starting Prompt Benchmark Execution...");

    for (const [agent, prompts] of Object.entries(testBank)) {
        console.log(`\n🤖 Testing Agent: ${agent.toUpperCase()}`);
        reportData.results[agent] = {
            total_tested: 0,
            avg_latency_ms: 0,
            avg_score: 0,
            cases: []
        };

        const questionList = prompts as string[];
        let totalLatency = 0;
        let totalScore = 0;

        for (let i = 0; i < questionList.length; i++) {
            const query = questionList[i];
            console.log(`  [Q${i + 1}] ${query}`);
            
            const start = Date.now();
            
            // Simulation of local / AI Gateway fetch
            await new Promise(r => setTimeout(r, Math.random() * 2000 + 500));
            const latency = Date.now() - start;
            
            // Simulation of LLM-as-judge score (3-5)
            const simulatedScore = Math.floor(Math.random() * 3) + 3;

            reportData.results[agent].cases.push({
                query,
                latency_ms: latency,
                score: simulatedScore,
                tokens: Math.floor(Math.random() * 300) + 150
            });

            totalLatency += latency;
            totalScore += simulatedScore;
        }

        reportData.results[agent].avg_latency_ms = Math.round(totalLatency / questionList.length);
        reportData.results[agent].avg_score = (totalScore / questionList.length).toFixed(1);
        reportData.results[agent].total_tested = questionList.length;
        console.log(`  => Avg Latency: ${reportData.results[agent].avg_latency_ms}ms, Avg Score: ${reportData.results[agent].avg_score}`);
    }

    const reportName = `prompt-benchmark-${new Date().toISOString().split('T')[0].replace(/-/g, '')}.json`;
    const reportPath = path.join(REPORTS_DIR, reportName);
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf-8');
    
    console.log(`\n✅ Benchmark completed. Report saved to ${reportPath}`);
}

runBenchmark().catch(console.error);
