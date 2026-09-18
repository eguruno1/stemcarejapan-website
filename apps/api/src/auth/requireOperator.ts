import type { RequestHandler } from 'express';
import type { OperatorRole } from '@stemcare/shared';
import { config } from '../config';
import { unauthorized } from '../common/errors';
import { verifyOperatorToken } from './token';
import { getOperatorById } from './authService';
import { asyncHandler } from '../common/asyncHandler';

// Express 의 Request 타입에 operator 속성을 추가로 알려준다.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      operator?: { operatorId: string; role: OperatorRole };
    }
  }
}

export const requireOperator: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[config.adminCookieName];

  if (typeof token !== 'string' || token.length === 0) {
    next(unauthorized());
    return;
  }

  const payload = verifyOperatorToken(token);
  if (!payload) {
    next(unauthorized('세션이 만료되었습니다. 다시 로그인해주세요.'));
    return;
  }

  const operator = await getOperatorById(payload.operatorId);
  req.operator = { operatorId: operator.id, role: operator.role };
  next();
});
