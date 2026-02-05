import { Rule } from '../models';
import { NotionProperties } from '../types';
export interface MatchResult {
    ruleId: string;
    ruleName: string;
    databaseId: string;
    properties: NotionProperties;
    originalText: string;
    processedText: string;
}
/**
 * Process message text and match against rules
 */
export declare function processMessage(text: string, projectId: string): Promise<MatchResult | null>;
/**
 * Get all rules for a project
 */
export declare function getRulesForProject(projectId: string): Promise<Rule[]>;
//# sourceMappingURL=rules.service.d.ts.map