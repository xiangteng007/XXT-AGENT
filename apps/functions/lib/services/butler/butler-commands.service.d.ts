/**
 * Butler Quick Commands Service
 *
 * Parses natural language LINE messages into structured commands
 * and executes them against real Firestore data via domain services.
 *
 * Supported commands:
 *   記帳 500 午餐     → record expense
 *   收入 50000 薪資   → record income
 *   體重 80.5         → record weight
 *   步數 8500         → record steps
 *   加油 45L 32.5     → record fuel
 *   里程 16000        → update mileage
 *   明天 14:00 開會   → add event
 *   提醒 週五 繳房租  → add reminder
 */
export interface ParsedCommand {
    action: string;
    params: Record<string, unknown>;
    confidence: number;
    display: string;
}
export declare function parseCommand(text: string): ParsedCommand | null;
export declare function executeCommand(userId: string, cmd: ParsedCommand): Promise<string>;
//# sourceMappingURL=butler-commands.service.d.ts.map