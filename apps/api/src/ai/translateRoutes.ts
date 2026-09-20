import { getChatSettings } from '../settings/chatSettings';
import { prisma } from '../db';
import { notFound } from '../common/errors';
import { Router } from 'express';
import { z } from 'zod';
import { LANGUAGES } from '@stemcare/shared';
import { requireOperator } from '../auth/requireOperator';
import { asyncHandler } from '../common/asyncHandler';
import { AppError } from '../common/errors';
import { validateBody } from '../common/validate';
import { translate, translationFailureMessage } from './translator';

const PreviewSchema = z
  .object({
    roomId: z.string().uuid().optional(),
    text: z.string().trim().min(1, '번역할 내용을 입력해주세요.').max(2000),
    sourceLanguage: z.enum(LANGUAGES),
    targetLanguage: z.enum(LANGUAGES)
  })
  .refine((body) => body.sourceLanguage !== body.targetLanguage, {
    message: '출발 언어와 도착 언어가 같습니다.',
    path: ['targetLanguage']
  });

export const translateRoutes = Router();

translateRoutes.use(requireOperator);

translateRoutes.post(
  '/preview',
  validateBody(PreviewSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof PreviewSchema>;

    const settings = await getChatSettings();
    const room = body.roomId ? await prisma.chatRoom.findUnique({ where: { id: body.roomId } }) : null;
    if (body.roomId && !room) throw notFound('상담방을 찾을 수 없습니다.');
    if (!settings.translationEnabled || room?.translationEnabled === false) {
      res.json({ translatedText: body.text, translationEnabled: false, sourceLanguage: body.sourceLanguage, targetLanguage: body.sourceLanguage, model: null });
      return;
    }
    const result = await translate({
      text: body.text,
      source: body.sourceLanguage,
      target: body.targetLanguage
    });

    if (result.status === 'failed') {
      throw new AppError(
        503,
        'TRANSLATION_FAILED',
        translationFailureMessage(result.reason)
      );
    }

    const latestRoom = room ? await prisma.chatRoom.findUnique({ where: { id: room.id } }) : null;
    if ((room && latestRoom?.translationRevision !== room.translationRevision) || (await getChatSettings()).revision !== settings.revision) throw new AppError(409, 'SETTINGS_CHANGED', '번역 설정이 변경되었습니다. 다시 시도해주세요.');
    res.json({
      translationEnabled: true,
      translatedText: result.text,
      sourceLanguage: body.sourceLanguage,
      targetLanguage: body.targetLanguage,
      model: result.status === 'done' ? result.model : null
    });
  })
);
