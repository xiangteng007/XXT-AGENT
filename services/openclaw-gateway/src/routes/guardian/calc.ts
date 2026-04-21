import { Router, Request, Response } from 'express';
import { logger } from '../../logger';
import {
  calcPremiumSummary,
  calcCarPremium, calcLifeInsurance, calcWorkersComp,
} from '../../insurance-store';

export const calcRouter = Router();

calcRouter.post('/car', async (req: Request, res: Response) => {
  const { contract_value, duration_months, workers, project_name, complexity } = req.body as {
    contract_value?: number; duration_months?: number; workers?: number;
    project_name?: string; complexity?: 'low' | 'medium' | 'high';
  };

  if (!contract_value || contract_value <= 0 || !duration_months || !workers) {
    res.status(400).json({
      error: 'contract_value, duration_months, workers are required',
      example: {
        contract_value: 8500000,
        duration_months: 18,
        workers: 12,
        project_name: '台積電廠房整修工程',
        complexity: 'medium',
      },
    });
    return;
  }

  const result = calcCarPremium({ contract_value, duration_months, workers, project_name, complexity });
  logger.info(`[Guardian/calc/car] contract=${contract_value} workers=${workers} total=${result.total_annual_premium}`);

  res.json({
    ok: true,
    calc_type: 'engineering_insurance',
    ...result,
    summary_message: `工程保費估算：年繳約 NT$${result.total_annual_premium.toLocaleString()}（CAR+PLI+職災），工期 ${duration_months} 個月合計約 NT$${(result.car_premium + result.pli_premium).toLocaleString()}`,
  });
});

calcRouter.post('/life', async (req: Request, res: Response) => {
  const { annual_salary, debts, income_years, mortgage, children, education_per_child } = req.body as {
    annual_salary?: number; debts?: number; income_years?: number;
    mortgage?: number; children?: number; education_per_child?: number;
  };

  if (!annual_salary || annual_salary <= 0) {
    res.status(400).json({
      error: 'annual_salary required',
      example: { annual_salary: 1440000, debts: 500000, mortgage: 8000000, children: 2 },
    });
    return;
  }

  const result = calcLifeInsurance({ annual_salary, debts, income_years, mortgage, children, education_per_child });
  logger.info(`[Guardian/calc/life] salary=${annual_salary} coverage=${result.recommended_coverage}`);

  res.json({
    ok: true, calc_type: 'life_insurance_dime', ...result,
    summary_message: `建議壽險保額 NT$${result.recommended_coverage.toLocaleString()}，定期壽險月繳估算 NT$${result.monthly_premium_estimate.toLocaleString()}`,
    legal_basis: '依 DIME 法則（Debt×Income×Mortgage×Education）計算最低保障需求',
  });
});

calcRouter.post('/workers', async (req: Request, res: Response) => {
  const { monthly_salary, workers } = req.body as { monthly_salary?: number; workers?: number };

  if (!monthly_salary || monthly_salary <= 0) {
    res.status(400).json({
      error: 'monthly_salary required',
      example: { monthly_salary: 45000, workers: 12 },
    });
    return;
  }

  const result = calcWorkersComp({ monthly_salary, workers });
  logger.info(`[Guardian/calc/workers] salary=${monthly_salary} workers=${workers} worst=${result.worst_case_total}`);

  res.json({ ok: true, calc_type: 'workers_compensation', ...result });
});

calcRouter.get('/premium', async (_req: Request, res: Response) => {
  const summary = await calcPremiumSummary();
  res.json({ ok: true, ...summary });
});
