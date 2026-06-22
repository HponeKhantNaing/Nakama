'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import type { ActionResult } from '@/types';

const updateNameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1),
});

export async function updateProfileName(
  input: z.infer<typeof updateNameSchema>
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const parsed = updateNameSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid name' };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { name: parsed.data.name },
    });

    revalidatePath('/profile');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update name' };
  }
}

export async function changeProfilePassword(
  input: z.infer<typeof changePasswordSchema>
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid password' };
    }

    if (parsed.data.newPassword !== parsed.data.confirmPassword) {
      return { success: false, error: 'Passwords do not match' };
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return { success: false, error: 'Current password is incorrect' };
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash },
    });

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to change password' };
  }
}
