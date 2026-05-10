export const UserStatus = {
  AwaitingApproval: 'awaiting_approval',
  Approved: 'approved',
  Suspended: 'suspended',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
