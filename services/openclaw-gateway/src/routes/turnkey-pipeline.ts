import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../logger';
import { 
  createTurnkeyProject, 
  getTurnkeyProject, 
  updateTurnkeyProjectState, 
  listActiveTurnkeyProjects,
  type TurnkeyProject,
  type TurnkeyStatus
} from '../stores/turnkey-store';

export const turnkeyRouter = Router();

// Create new turnkey pipeline project
turnkeyRouter.post('/create', async (req: Request, res: Response) => {
  const { client_id, project_name } = req.body as { client_id?: string; project_name?: string };
  if (!client_id || !project_name) {
    res.status(400).json({ error: 'client_id and project_name are required' });
    return;
  }

  const project: TurnkeyProject = {
    id: crypto.randomUUID(),
    client_id,
    project_name,
    status: 'intake',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await createTurnkeyProject(project);
  logger.info(`[Turnkey] Pipeline initiated for project ${project.id}. Delegating to Lumi (Intake)...`);
  
  res.status(201).json({ 
    message: 'Turnkey project created successfully.',
    project,
    next_action: 'Please instruct Lumi with floorplans and design requirements.'
  });
});

// Advance pipeline state
turnkeyRouter.post('/:id/advance', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { next_stage, payload } = req.body as { next_stage: TurnkeyStatus, payload: any };
  
  const project = await getTurnkeyProject(id as string);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const updates: Partial<TurnkeyProject> = { status: next_stage };
  let orchestrator_msg = '';

  switch (next_stage) {
    case 'design':
      updates.lumi_data = payload;
      orchestrator_msg = 'Lumi has completed design concept. Handing over to Rusty for estimation.';
      break;
    case 'estimation':
      updates.rusty_data = payload;
      orchestrator_msg = 'Rusty has completed BOM and engineering quantification. Handing over to Lex for contract drafting.';
      break;
    case 'contract':
      updates.lex_data = payload;
      orchestrator_msg = 'Contract signed by Lex & Client. Handing over to Titan for construction kickoff.';
      break;
    case 'construction':
      updates.titan_data = payload;
      orchestrator_msg = 'Titan tracking construction progress.';
      break;
    case 'completed':
      orchestrator_msg = 'Project successfully delivered and closed.';
      break;
    default:
      res.status(400).json({ error: 'Invalid next_stage' });
      return;
  }

  await updateTurnkeyProjectState(id as string, updates);
  logger.info(`[Turnkey] Project ${id} advanced to ${next_stage}.`);

  res.json({
    message: 'Pipeline advanced',
    project_id: id,
    status: next_stage,
    orchestrator_msg
  });
});

// Get pipeline status
turnkeyRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const project = await getTurnkeyProject(id as string);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json(project);
});

// List all active turnkey projects
turnkeyRouter.get('/', async (_req: Request, res: Response) => {
  const projects = await listActiveTurnkeyProjects();
  res.json({ count: projects.length, projects });
});
