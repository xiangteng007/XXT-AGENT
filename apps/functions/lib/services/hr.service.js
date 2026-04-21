"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRService = void 0;
class HRService {
    /**
     * Calculate monthly salary based on Taiwan Labor Standards Act (2024 rules).
     */
    static calculateSalary(payload) {
        const { baseSalary, overtimeHoursWeekday = 0, overtimeHoursHoliday = 0, dependents = 0, employeePensionRate = 0 } = payload;
        // 1. Calculate Overtime
        const hourlyRate = Math.round(baseSalary / 240);
        let overtimePay = 0;
        // Weekday overtime
        if (overtimeHoursWeekday <= 2) {
            overtimePay += overtimeHoursWeekday * hourlyRate * 1.34;
        }
        else {
            overtimePay += 2 * hourlyRate * 1.34 + (overtimeHoursWeekday - 2) * hourlyRate * 1.67;
        }
        // Holiday overtime
        if (overtimeHoursHoliday <= 8) {
            overtimePay += overtimeHoursHoliday * hourlyRate * 2;
        }
        else {
            overtimePay += 8 * hourlyRate * 2 + (overtimeHoursHoliday - 8) * hourlyRate * 2.67;
        }
        overtimePay = Math.round(overtimePay);
        // 2. Labor Insurance (employee share: 1.2%)
        const laborInsurance = Math.round(baseSalary * 0.012);
        // 3. Health Insurance (employee share: 2.11%, adjusted by dependents)
        const effectiveDependents = Math.min(dependents, 3);
        const healthInsurance = Math.round(baseSalary * 0.0211 * (1 + effectiveDependents));
        // 4. Pension (employee self-contribution)
        const pension = Math.round(baseSalary * employeePensionRate);
        // 5. Net Pay
        const netPay = baseSalary + overtimePay - laborInsurance - healthInsurance - pension;
        return {
            baseSalary,
            overtimePay,
            laborInsurance,
            healthInsurance,
            pension,
            netPay
        };
    }
}
exports.HRService = HRService;
//# sourceMappingURL=hr.service.js.map