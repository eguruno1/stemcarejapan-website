import { Router } from 'express';
import { z } from 'zod';
import { LANGUAGES } from '@stemcare/shared';
import { requireOperator } from '../auth/requireOperator';
import { asyncHandler } from '../common/asyncHandler';
import { AppError } from '../common/errors';
import { validateBody } from '../common/validate';
import { translate } from './translator';

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

    const result = await translate({
      text: body.text,
      source: body.sourceLanguage,
      target: body.targetLanguage
    });

    if (result.status === 'failed') {
      throw new AppError(
        503,
        'TRANSLATION_FAILED',
        '번역에 실패했습니다. 직접 작성하거나 잠시 후 다시 시도해주세요.'
      );
    }

    res.json({
      translatedText: result.text,
      sourceLanguage: body.sourceLanguage,
      targetLanguage: body.targetLanguage,
      model: result.status === 'done' ? result.model : null
    });
  })
);
