import { Router } from 'express';
import { z } from 'zod';
import { requireOperator } from '../auth/requireOperator';
import { asyncHandler } from '../common/asyncHandler';
import { validateBody } from '../common/validate';
import { getChatSettings, saveChatSettings } from './chatSettings';
import { config } from '../config';
import { translate, translationFailureMessage } from '../ai/translator';
import { getIo } from '../realtime/socketServer';
import { broadcastStatus } from '../realtime/emitters';

export const settingsRoutes = Router();
settingsRoutes.use(requireOperator);
settingsRoutes.get('/', asyncHandler(async (_req, res) => {
  res.json({ settings: await getChatSettings(), models: { external: config.translationModel, ollama: config.ollamaModel }, externalConfigured: Boolean(config.openaiApiKey) });
}));
settingsRoutes.put('/', validateBody(z.object({ translationProvider: z.enum(['external', 'ollama']),
  translationEnabled: z.boolean(), aiEnabled: z.boolean(), revision: z.number().int().nonnegative() }).strict()), asyncHandler(async (req, res) => {
  const { settings, rooms } = await saveChatSettings(req.body);
  const io = getIo();
  if (io) for (const room of rooms) broadcastStatus(io, room.id, 'waiting', room.assignedOperatorId);
  res.json({ settings });
}));
settingsRoutes.post('/test-translation', validateBody(z.object({ provider: z.enum(['external', 'ollama']) }).strict()), asyncHandler(async (req, res) => {
  const started = Date.now();
  const result = await translate({ text: '明日の午後3時に2名で相談したいです。', source: 'ja', target: 'ko', provider: req.body.provider });
  res.json({ result, elapsedMs: Date.now() - started, ...(result.status === 'failed' ? { message: translationFailureMessage(result.reason) } : {}) });
}));
