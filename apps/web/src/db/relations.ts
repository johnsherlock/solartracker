import { relations } from 'drizzle-orm';
import {
  dailySummaries,
  dataHealthEvents,
  deletionRequests,
  installationContracts,
  installations,
  jobRuns,
  providerConnections,
  tariffFixedChargeVersions,
  tariffPlanVersions,
  tariffPlans,
  tariffPricePeriods,
  users,
} from './schema';

export const usersRelations = relations(users, ({ many }) => ({
  installations: many(installations),
  deletionRequests: many(deletionRequests),
}));

export const installationsRelations = relations(installations, ({ one, many }) => ({
  user: one(users, {
    fields: [installations.userId],
    references: [users.id],
  }),
  tariffPlans: many(tariffPlans),
  providerConnections: many(providerConnections),
  installationContracts: many(installationContracts),
  dailySummaries: many(dailySummaries),
  dataHealthEvents: many(dataHealthEvents),
  jobRuns: many(jobRuns),
}));

export const tariffPlansRelations = relations(tariffPlans, ({ one, many }) => ({
  installation: one(installations, {
    fields: [tariffPlans.installationId],
    references: [installations.id],
  }),
  versions: many(tariffPlanVersions),
  contracts: many(installationContracts),
}));

export const tariffPlanVersionsRelations = relations(tariffPlanVersions, ({ one, many }) => ({
  tariffPlan: one(tariffPlans, {
    fields: [tariffPlanVersions.tariffPlanId],
    references: [tariffPlans.id],
  }),
  fixedChargeVersions: many(tariffFixedChargeVersions),
  pricePeriods: many(tariffPricePeriods),
}));

export const tariffFixedChargeVersionsRelations = relations(tariffFixedChargeVersions, ({ one }) => ({
  tariffPlanVersion: one(tariffPlanVersions, {
    fields: [tariffFixedChargeVersions.tariffPlanVersionId],
    references: [tariffPlanVersions.id],
  }),
}));

export const tariffPricePeriodsRelations = relations(tariffPricePeriods, ({ one }) => ({
  tariffPlanVersion: one(tariffPlanVersions, {
    fields: [tariffPricePeriods.tariffPlanVersionId],
    references: [tariffPlanVersions.id],
  }),
}));

export const installationContractsRelations = relations(installationContracts, ({ one }) => ({
  installation: one(installations, {
    fields: [installationContracts.installationId],
    references: [installations.id],
  }),
  tariffPlan: one(tariffPlans, {
    fields: [installationContracts.tariffPlanId],
    references: [tariffPlans.id],
  }),
}));

export const providerConnectionsRelations = relations(providerConnections, ({ one, many }) => ({
  installation: one(installations, {
    fields: [providerConnections.installationId],
    references: [installations.id],
  }),
  dataHealthEvents: many(dataHealthEvents),
}));

export const dailySummariesRelations = relations(dailySummaries, ({ one }) => ({
  installation: one(installations, {
    fields: [dailySummaries.installationId],
    references: [installations.id],
  }),
}));

export const jobRunsRelations = relations(jobRuns, ({ one }) => ({
  installation: one(installations, {
    fields: [jobRuns.installationId],
    references: [installations.id],
  }),
}));

export const dataHealthEventsRelations = relations(dataHealthEvents, ({ one }) => ({
  installation: one(installations, {
    fields: [dataHealthEvents.installationId],
    references: [installations.id],
  }),
  providerConnection: one(providerConnections, {
    fields: [dataHealthEvents.providerConnectionId],
    references: [providerConnections.id],
  }),
}));

export const deletionRequestsRelations = relations(deletionRequests, ({ one }) => ({
  user: one(users, {
    fields: [deletionRequests.userId],
    references: [users.id],
  }),
}));
