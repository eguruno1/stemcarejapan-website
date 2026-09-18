import { randomUUID } from 'node:crypto';
import type { ChatRoom, Customer, Operator } from '@prisma/client';
import { prisma } from '../../src/db';
import { hashPassword } from '../../src/auth/password';
import { createVisitorToken, hashVisitorToken } from '../../src/auth/token';

export async function createOperator(
  overrides: Partial<{ name: string; email: string; password: string; role: string; isActive: boolean }> = {}
): Promise<{ operator: Operator; plainPassword: string }> {
  const plainPassword = overrides.password ?? 'test-password-1234';
  const operator = await prisma.operator.create({
    data: {
      name: overrides.name ?? '테스트 운영자',
      email: overrides.email ?? `op-${randomUUID()}@example.com`,
      passwordHash: await hashPassword(plainPassword),
      role: overrides.role ?? 'operator',
      isActive: overrides.isActive ?? true
    }
  });
  return { operator, plainPassword };
}

export async function createCustomerWithRoom(
  overrides: Partial<{
    name: string;
    phone: string;
    preferredLanguage: string;
    serviceType: string;
    status: string;
  }> = {}
): Promise<{ customer: Customer; room: ChatRoom; visitorToken: string }> {
  const customer = await prisma.customer.create({
    data: {
      name: overrides.name ?? '야마다 타로',
      phone: overrides.phone ?? '+81 90-1111-2222',
      preferredLanguage: overrides.preferredLanguage ?? 'ja',
      serviceType: overrides.serviceType ?? 'korea_travel',
      privacyAgreedAt: new Date()
    }
  });

  const visitorToken = createVisitorToken();
  const room = await prisma.chatRoom.create({
    data: {
      customerId: customer.id,
      serviceType: customer.serviceType,
      status: overrides.status ?? 'bot',
      visitorTokenHash: hashVisitorToken(visitorToken)
    }
  });

  return { customer, room, visitorToken };
}
