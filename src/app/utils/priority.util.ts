import { RequestPriority } from '../models/request.model';

// Priority is only a label. The choices are listed from most to least urgent,
// the same order the admin queue uses.
export const PRIORITY_CHOICES: { value: RequestPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function priorityLabel(priority: RequestPriority): string {
  return PRIORITY_CHOICES.find((c) => c.value === priority)?.label ?? priority;
}