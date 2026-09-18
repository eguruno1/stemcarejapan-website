import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../common/asyncHandler';
import { validateBody } from '../common/validate';
import { config } from '../config';
import { getOperatorById, loginOperator } from './authService';
import { requireOperator } from './requireOperator';

const LoginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.').max(200)
});

/** 개발 환경(http)에서는 secure=false 여야 쿠키가 저장된다. */
function cookieOptions() {
  return {
    httpOnly: true as const,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 12 * 60 * 60 * 1000
  };
}

export const authRoutes = Router();

authRoutes.post(
  '/login',
  validateBody(LoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof LoginSchema>;
    const { operator, token } = await loginOperator(email, password);

    res.cookie(config.adminCookieName, token, cookieOptions());
    res.json({ operator });
  })
);

authRoutes.post('/logout', (_req, res) => {
  res.clearCookie(config.adminCookieName, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

authRoutes.get(
  '/me',
  requireOperator,
  asyncHandler(async (req, res) => {
    const operator = await getOperatorById(req.operator!.operatorId);
    res.json({ operator });
  })
);
