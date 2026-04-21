"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleHR = void 0;
const v2_1 = require("firebase-functions/v2");
const hr_service_1 = require("../services/hr.service");
const handleHR = async (req, res) => {
    // 允許 CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        const { action, payload } = req.body;
        if (!action || !payload) {
            res.status(400).json({ error: 'Missing action or payload' });
            return;
        }
        let result;
        switch (action) {
            case 'calculateSalary':
                result = hr_service_1.HRService.calculateSalary(payload);
                break;
            default:
                res.status(400).json({ error: `Unsupported action: ${action}` });
                return;
        }
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        v2_1.logger.error('[HR Handler Error]', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.handleHR = handleHR;
//# sourceMappingURL=hr.handler.js.map