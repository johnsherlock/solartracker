import { relations } from 'drizzle-orm';
import {
  billingComparisons,
  dailySummaries,
  dataHealthEvents,
  deletionRequests,
  energyReadings,
  installationContracts,
  installations,
  jobRuns,
  providerConnections,
  providerRawImports,
  tariffFixedChargeVersions,
  tariffPlanVersions,
  tariffPlans,
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
  energyReadings: many(energyReadings),
  dailySummaries: many(dailySummaries),
  billingComparisons: many(billingComparisons),
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
}));

export const tariffFixedChargeVersionsRelations = relations(tariffFixedChargeVersions, ({ one }) => ({
  tariffPlanVersion: one(tariffPlanVersions, {
    fields: [tariffFixedChargeVersions.tariffPlanVersionId],
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
  energyReadings: many(energyReadings),
  providerRawImports: many(providerRawImports),
  dataHealthEvents: many(dataHealthEvents),
}));

export const energyReadingsRelations = relations(energyReadings, ({ one }) => ({
  installation: one(installations, {
    fields: [energyReadings.installationId],
    references: [installations.id],
  }),
  providerConnection: one(providerConnections, {
    fields: [energyReadings.providerConnectionId],
    references: [providerConnections.id],
  }),
}));

export const dailySummariesRelations = relations(dailySummaries, ({ one }) => ({
  installation: one(installations, {
    fields: [dailySummaries.installationId],
    references: [installations.id],
  }),
}));

export const billingComparisonsRelations = relations(billingComparisons, ({ one }) => ({
  installation: one(installations, {
    fields: [billingComparisons.installationId],
    references: [installations.id],
  }),
}));

export const jobRunsRelations = relations(jobRuns, ({ one, many }) => ({
  installation: one(installations, {
    fields: [jobRuns.installationId],
    references: [installations.id],
  }),
  providerRawImports: many(providerRawImports),
}));

export const providerRawImportsRelations = relations(providerRawImports, ({ one }) => ({
  providerConnection: one(providerConnections, {
    fields: [providerRawImports.providerConnectionId],
    references: [providerConnections.id],
  }),
  importRun: one(jobRuns, {
    fields: [providerRawImports.importRunId],
    references: [jobRuns.id],
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
