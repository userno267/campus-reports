import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RequestPriority } from '../models/request.model';
import { priorityLabel } from '../utils/priority.util';

// The ONE place that draws a priority label. Shows nothing when there is no priority
// (a request that has not been assigned yet). Priority is only a label: no deadline, no timer.
@Component({
  selector: 'app-priority-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (priority(); as p) {
      <span class="chip" [attr.data-level]="p">{{ label(p) }}</span>
    }
  `,
  styles: [`
    .chip {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.2;
      border: 1px solid #e2e8dc;
      background: #e8efe3;
      color: #29483d;
      white-space: nowrap;
    }
    .chip[data-level='low'] {
      background: #e8efe3;
      color: #29483d;
    }
    .chip[data-level='medium'] {
      background: #f3efd6;
      border-color: #e6dfb4;
      color: #6b5d1f;
    }
    .chip[data-level='high'] {
      background: #f9e3cc;
      border-color: #eccaa3;
      color: #8a4b12;
    }
    .chip[data-level='urgent'] {
      background: #f6d9d5;
      border-color: #e8b5ae;
      color: #8a2f26;
    }
  `],
})
export class PriorityBadgeComponent {
  priority = input<RequestPriority | null | undefined>(null);

  protected label(p: RequestPriority): string {
    return priorityLabel(p);
  }
}