"use strict";
/**
 * @xxt-agent/types — Agent 型別定義 (B-4)
 *
 * 集中管理所有 Agent 相關型別，消除各 route 內的
 * inline type 重複定義。Gateway route 應從此處 import。
 *
 * @since v8.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_AGENT_IDS = void 0;
exports.ALL_AGENT_IDS = [
    'accountant', 'guardian', 'finance', 'scout', 'zora', 'lex',
    'nova', 'titan', 'lumi', 'rusty', 'invest', 'sage',
];
