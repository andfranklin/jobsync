import "server-only";
import prisma from "@/lib/db";
import { CurrentUser } from "@/models/user.model";

export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  const user = await prisma.user.findFirst();
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email };
};
