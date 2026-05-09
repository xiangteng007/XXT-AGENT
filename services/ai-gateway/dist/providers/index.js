"use strict";
/**
 * Provider Manager
 *
 * Unified interface for initializing and routing to AI providers.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProviderStatus = getProviderStatus;
exports.initializeProviders = initializeProviders;
exports.generateText = generateText;
const gemini = __importStar(require("./gemini.provider"));
const openai = __importStar(require("./openai.provider"));
const anthropic = __importStar(require("./anthropic.provider"));
const config_1 = require("../config");
let isInitialized = false;
/**
 * Provider readiness state — exposed for health checks
 */
function getProviderStatus() {
    return {
        google: gemini.isReady(),
        openai: openai.isReady(),
        anthropic: anthropic.isReady(),
    };
}
/**
 * Initialize all AI providers (idempotent)
 */
async function initializeProviders() {
    if (isInitialized)
        return;
    await Promise.allSettled([
        gemini.initialize(),
        openai.initialize(),
        anthropic.initialize(),
    ]);
    isInitialized = true;
}
/**
 * Unified text generation — routes to correct provider based on model ID
 */
async function generateText(prompt, modelId = config_1.DEFAULT_MODEL) {
    const model = config_1.SUPPORTED_MODELS[modelId];
    const provider = model?.provider || 'google';
    const resolvedModelId = model ? modelId : config_1.DEFAULT_MODEL;
    switch (provider) {
        case 'openai':
            return openai.generateText(prompt, resolvedModelId);
        case 'anthropic':
            return anthropic.generateText(prompt, resolvedModelId);
        case 'google':
        default:
            return gemini.generateText(prompt, resolvedModelId);
    }
}
