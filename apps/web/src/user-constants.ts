export const UserRole = {
  User: 'user',
  Admin: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  AwaitingApproval: 'awaiting_approval',
  Approved: 'approved',
  Suspended: 'suspended',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
