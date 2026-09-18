import type { Operator } from '@prisma/client';
import type { OperatorDTO, OperatorRole } from '@stemcare/shared';
import { AppError, forbidden, unauthorized } from '../common/errors';
import { prisma } from '../db';
import { verifyPassword } from './password';
import { signOperatorToken } from './token';

export function toOperatorDTO(row: Operator): OperatorDTO {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as OperatorRole,
    isActive: row.isActive
  };
}

export async function loginOperator(
  email: string,
  password: string
): Promise<{ operator: OperatorDTO; token: string }> {
  const found = await prisma.operator.findUnique({ where: { email: email.toLowerCase().trim() } });

  if (!found) {
    // 계정 열거 방지: 없는 계정도 "자격 증명 오류"로 통일한다.
    throw new AppError(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  const passwordMatches = await verifyPassword(password, found.passwordHash);
  if (!passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  if (!found.isActive) {
    throw new AppError(403, 'OPERATOR_DISABLED', '비활성화된 계정입니다. 관리자에게 문의하세요.');
  }

  const token = signOperatorToken({ operatorId: found.id, role: found.role as OperatorRole });
  return { operator: toOperatorDTO(found), token };
}

export async function getOperatorById(operatorId: string): Promise<OperatorDTO> {
  const found = await prisma.operator.findUnique({ where: { id: operatorId } });
  if (!found || !found.isActive) {
    throw unauthorized('세션이 만료되었습니다. 다시 로그인해주세요.');
  }
  return toOperatorDTO(found);
}

export function assertAdmin(role: OperatorRole): void {
  if (role !== 'admin') {
    throw forbidden('관리자 권한이 필요합니다.');
  }
}
