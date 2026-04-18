import { v4 as uuid } from 'uuid';
import type { Plan } from '../types';
import { STORAGE_KEYS } from '../constants';
import { PlanSchema } from '../schemas/plan-schema';
import { migratePlan } from '../schemas/migrations';
import { deleteValue, getValue, setValue } from './storage';

export async function listPlanIds(): Promise<string[]> {
  return (await getValue<string[]>(STORAGE_KEYS.plansIndex)) ?? [];
}

export async function getPlan(id: string): Promise<Plan | null> {
  const raw = await getValue<unknown>(STORAGE_KEYS.plan(id));
  if (!raw) return null;
  const migrated = migratePlan(raw);
  const parsed = PlanSchema.safeParse(migrated);
  return parsed.success ? parsed.data : null;
}

export async function listPlans(): Promise<Plan[]> {
  const ids = await listPlanIds();
  const plans = await Promise.all(ids.map(getPlan));
  return plans.filter((p): p is Plan => p !== null);
}

export async function savePlan(plan: Plan): Promise<Plan> {
  const validated = PlanSchema.parse({
    ...plan,
    updatedAt: new Date().toISOString(),
  });
  const ids = await listPlanIds();
  if (!ids.includes(validated.id)) {
    const next = [validated.id, ...ids];
    await setValue(STORAGE_KEYS.plansIndex, next);
  } else {
    const next = [validated.id, ...ids.filter((i) => i !== validated.id)];
    await setValue(STORAGE_KEYS.plansIndex, next);
  }
  await setValue(STORAGE_KEYS.plan(validated.id), validated);
  return validated;
}

export async function deletePlan(id: string): Promise<void> {
  const ids = await listPlanIds();
  await setValue(STORAGE_KEYS.plansIndex, ids.filter((i) => i !== id));
  await deleteValue(STORAGE_KEYS.plan(id));
}

export function createEmptyPlan(aircraftProfileId: string): Plan {
  const now = new Date().toISOString();
  return PlanSchema.parse({
    schemaVersion: 1,
    id: uuid(),
    name: 'Untitled Plan',
    createdAt: now,
    updatedAt: now,
    departureIcao: '',
    destinationIcao: '',
    waypoints: [],
    legs: [],
    aircraftProfileId,
  });
}

export async function duplicatePlan(plan: Plan, newName?: string): Promise<Plan> {
  const now = new Date().toISOString();
  const id = uuid();
  const idMap = new Map<string, string>();
  const waypoints = plan.waypoints.map((w) => {
    const newId = uuid();
    idMap.set(w.id, newId);
    return { ...w, id: newId };
  });
  const legs = plan.legs.map((l) => ({
    ...l,
    fromId: idMap.get(l.fromId) ?? l.fromId,
    toId: idMap.get(l.toId) ?? l.toId,
  }));
  const copy: Plan = {
    ...plan,
    id,
    name: newName ?? `${plan.name} (copy)`,
    createdAt: now,
    updatedAt: now,
    waypoints,
    legs,
  };
  return savePlan(copy);
}
