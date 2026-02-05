"use strict";
/**
 * Social Adapters Index
 *
 * Export all available social platform adapters.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createThreadsAdapter = exports.createInstagramAdapter = exports.createFacebookAdapter = exports.createRSSAdapter = void 0;
exports.getAdapterByPlatform = getAdapterByPlatform;
exports.getAllAdapters = getAllAdapters;
exports.getSupportedPlatforms = getSupportedPlatforms;
var rss_adapter_1 = require("./rss.adapter");
Object.defineProperty(exports, "createRSSAdapter", { enumerable: true, get: function () { return rss_adapter_1.createRSSAdapter; } });
var meta_adapter_1 = require("./meta.adapter");
Object.defineProperty(exports, "createFacebookAdapter", { enumerable: true, get: function () { return meta_adapter_1.createFacebookAdapter; } });
Object.defineProperty(exports, "createInstagramAdapter", { enumerable: true, get: function () { return meta_adapter_1.createInstagramAdapter; } });
Object.defineProperty(exports, "createThreadsAdapter", { enumerable: true, get: function () { return meta_adapter_1.createThreadsAdapter; } });
const rss_adapter_2 = require("./rss.adapter");
const meta_adapter_2 = require("./meta.adapter");
/**
 * Adapter factory - creates adapter by platform name
 */
function getAdapterByPlatform(platform) {
    switch (platform) {
        case 'rss':
            return (0, rss_adapter_2.createRSSAdapter)();
        case 'facebook':
            return (0, meta_adapter_2.createFacebookAdapter)();
        case 'instagram':
            return (0, meta_adapter_2.createInstagramAdapter)();
        case 'threads':
            return (0, meta_adapter_2.createThreadsAdapter)();
        default:
            return null;
    }
}
/**
 * Get all available adapters
 */
function getAllAdapters() {
    return [
        (0, rss_adapter_2.createRSSAdapter)(),
        (0, meta_adapter_2.createFacebookAdapter)(),
        (0, meta_adapter_2.createInstagramAdapter)(),
        (0, meta_adapter_2.createThreadsAdapter)(),
    ];
}
/**
 * Get list of supported platforms
 */
function getSupportedPlatforms() {
    return ['rss', 'facebook', 'instagram', 'threads'];
}
//# sourceMappingURL=index.js.map