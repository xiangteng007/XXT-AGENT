export declare class HRService {
    /**
     * Calculate monthly salary based on Taiwan Labor Standards Act (2024 rules).
     */
    static calculateSalary(payload: {
        baseSalary: number;
        overtimeHoursWeekday?: number;
        overtimeHoursHoliday?: number;
        dependents?: number;
        employerPensionRate?: number;
        employeePensionRate?: number;
    }): {
        baseSalary: number;
        overtimePay: number;
        laborInsurance: number;
        healthInsurance: number;
        pension: number;
        netPay: number;
    };
}
//# sourceMappingURL=hr.service.d.ts.map