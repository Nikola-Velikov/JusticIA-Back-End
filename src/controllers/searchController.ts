import type { Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middlewares/validateRequest.js';
import { runLegalSearch } from '../services/searchService.js';

const sourceEnum = z.enum(['vas', 'vks', 'curia']);

const bgFiltersSchema = z
  .object({
    gid: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    court: z.string().trim().min(1).optional(),
    caseType: z.string().trim().min(1).optional(),
    caseNumber: z.number().int().nonnegative().optional(),
    caseYear: z.number().int().nonnegative().optional(),
    initiatingParty: z.string().trim().min(1).optional(),
    respondentParty: z.string().trim().min(1).optional(),
    judgeReporter: z.string().trim().min(1).optional(),
    department: z.string().trim().min(1).optional(),
    incommingNumber: z.number().int().nonnegative().optional(),
  })
  .strict();

const curiaFiltersSchema = z
  .object({
    caseName: z.string().trim().min(1).optional(),
    documentIdentifier: z.string().trim().min(1).optional(),
    decisionDate: z.string().trim().min(1).optional(),
    partyName: z.string().trim().min(1).optional(),
    field: z.string().trim().min(1).optional(),
  })
  .strict();

const searchSchema = z
  .object({
    query: z.string().trim().min(1),
    topN: z.number().int().min(1).max(100),
    useSources: z.array(sourceEnum).min(1),
    vasFilters: bgFiltersSchema.optional(),
    vksFilters: bgFiltersSchema.optional(),
    curiaFilters: curiaFiltersSchema.optional(),
    aiSummary: z.literal(true).optional().default(true),
  })
  .strict();

export const validateSearch = validateBody(searchSchema);

export async function postSearch(req: Request, res: Response) {
  const payload = (req as any).validatedBody as z.infer<typeof searchSchema>;
  const result = await runLegalSearch(payload);
  res.json(result);
}
