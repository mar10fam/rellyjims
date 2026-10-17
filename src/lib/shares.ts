import "server-only";
import { db } from "./db";

// ───────────────────────────── Loaders ─────────────────────────────

export function otherUsers(excludeUserId: string) {
  return db.user.findMany({
    where: { id: { not: excludeUserId } },
    orderBy: { username: "asc" },
    select: { id: true, username: true, name: true },
  });
}

export function sharableSplits(ownerId: string) {
  return db.split.findMany({
    where: { ownerId, archived: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export function pendingSharesReceived(userId: string) {
  return db.splitShare.findMany({
    where: { toUserId: userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      split: { select: { name: true, description: true } },
      fromUser: { select: { username: true, name: true } },
    },
  });
}

export function sentShares(userId: string) {
  return db.splitShare.findMany({
    where: { fromUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      split: { select: { name: true } },
      toUser: { select: { username: true, name: true } },
    },
  });
}

export function ownedShare(shareId: string, toUserId: string) {
  return db.splitShare.findFirst({
    where: { id: shareId, toUserId, status: "PENDING" },
    include: {
      split: {
        include: {
          days: {
            orderBy: { order: "asc" },
            include: {
              groups: {
                orderBy: { order: "asc" },
                include: { slots: { orderBy: { order: "asc" }, include: { exercise: true } } },
              },
            },
          },
        },
      },
    },
  });
}
