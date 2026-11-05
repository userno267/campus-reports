import {
  ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonInput, IonItem, IonLabel, IonList } from '@ionic/angular';

// Any list entry with an id and a name (categories and locations both fit).
export interface PickerItem {
  id: number;
  name: string;
}

// How many matches to show at once. Keeps the list short on a phone.
const MAX_SUGGESTIONS = 8;

// Lowercase, single spaces, no edges. "  Room   101 " becomes "room 101".
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// A text box you can type into, with a list that narrows as you type.
//  - Every word typed must appear in the name, in any order: "room 1" finds "Room 1", "Room 101", "Room 1 BSIT".
//  - Names that start with the typed text are listed first.
//  - Pick one from the list to select it. Typing again clears the selection until you pick again.
//  - allowCreate: when nothing matches exactly, offers "Add "...". Creating is the parent's job (it calls the server).
//  - clear(): the parent calls this after a successful submit to empty the box.
@Component({
  selector: 'app-searchable-picker',
  standalone: true,
  imports: [FormsModule, IonInput, IonItem, IonLabel, IonList],
  template: `
    <ion-item lines="none" class="picker-field">
      <ion-input
        [label]="label"
        labelPlacement="floating"
        [placeholder]="placeholder"
        [value]="query"
        [disabled]="disabled"
        autocomplete="off"
        (ionInput)="onType($event.detail.value)"
        (ionFocus)="onFocus()"
        (ionBlur)="onBlur()"
      ></ion-input>
    </ion-item>

    @if (open && (suggestions.length > 0 || showAdd)) {
      <ion-list class="suggest-list">
        @for (item of suggestions; track item.id) {
          <ion-item button detail="false" (click)="pick(item)">
            <ion-label class="ion-text-wrap">{{ item.name }}</ion-label>
          </ion-item>
        }
        @if (showAdd) {
          <ion-item button detail="false" class="add-row" (click)="addNew()">
            <ion-label class="ion-text-wrap">{{ addText }}</ion-label>
          </ion-item>
        }
      </ion-list>
    }

    @if (query !== '' && selectedId === null && !open) {
      <p class="picker-hint">Pick one from the list{{ allowCreate ? ' or add it' : '' }}.</p>
    }
  `,
  styles: [`
    .picker-field {
      --padding-start: 0;
    }
    .suggest-list {
      margin: 0 0 8px;
      border: 1px solid #e2e8dc;
      border-radius: 12px;
      overflow: hidden;
      background: #fbfaf5;
    }
    .suggest-list ion-item {
      --background: #fbfaf5;
      --color: #29483d;
      --border-color: #e2e8dc;
    }
    .add-row {
      --color: #29483d;
      font-weight: 600;
    }
    .picker-hint {
      margin: 0 0 8px 16px;
      color: #87958a;
      font-size: 12px;
    }
  `],
})
export class SearchablePickerComponent implements OnChanges {
  private cdr = inject(ChangeDetectorRef);

  @Input() items: PickerItem[] = [];
  @Input() label = '';
  @Input() placeholder = '';
  @Input() selectedId: number | null = null;
  @Input() allowCreate = false;
  // Word used in the "Add ... as a new ..." row, for example "location".
  @Input() addNoun = 'item';
  @Input() disabled = false;

  // Sent to the parent when a list entry is picked (id) or cleared by typing (null).
  @Output() selectedChange = new EventEmitter<number | null>();
  // Sent when the user chooses "Add ..." (the typed name, tidied).
  @Output() created = new EventEmitter<string>();

  query = '';
  open = false;
  suggestions: PickerItem[] = [];
  showAdd = false;
  addText = '';

  // The id this box last selected, so it knows whether the parent changed the selection from outside.
  private picked: number | null = null;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedId'] || changes['items']) {
      const id = this.selectedId;
      if (id !== null) {
        const found = this.items.find((i) => i.id === id);
        if (found && this.picked !== id) {
          this.query = found.name;
        }
        this.picked = id;
      }
      this.refresh();
    }
  }

  onFocus(): void {
    this.open = true;
    this.refresh();
  }

  // The list closes after a short pause, so a tap on a list entry still registers.
  onBlur(): void {
    this.blurTimer = setTimeout(() => {
      this.open = false;
      this.cdr.detectChanges();
    }, 200);
  }

  onType(value: string | null | undefined): void {
    this.query = value ?? '';
    if (this.picked !== null) {
      this.picked = null;
      this.selectedChange.emit(null);
    }
    this.open = true;
    this.refresh();
  }

  pick(item: PickerItem): void {
    this.cancelBlur();
    this.picked = item.id;
    this.query = item.name;
    this.open = false;
    this.refresh();
    this.selectedChange.emit(item.id);
  }

  addNew(): void {
    this.cancelBlur();
    const name = this.displayName();
    if (name === '' || this.disabled) return;
    this.open = false;
    this.created.emit(name);
  }

  // Called by the parent after a successful submit. Empties the box without emitting anything.
  clear(): void {
    this.cancelBlur();
    this.query = '';
    this.picked = null;
    this.open = false;
    this.refresh();
  }

  private cancelBlur(): void {
    if (this.blurTimer !== null) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
  }

  // The typed text, tidied, in the case the user typed it.
  private displayName(): string {
    return this.query.replace(/\s+/g, ' ').trim();
  }

  // Works out the list from the current text. Runs on every change, so it is kept simple.
  private refresh(): void {
    const q = normalize(this.query);

    if (q === '') {
      this.suggestions = this.items.slice(0, MAX_SUGGESTIONS);
      this.showAdd = false;
      this.addText = '';
      return;
    }

    const words = q.split(' ');
    const matches = this.items.filter((item) => {
      const name = normalize(item.name);
      return words.every((w) => name.includes(w));
    });

    // Names that start with the typed text come first, then the rest, alphabetically.
    matches.sort((a, b) => {
      const aStarts = normalize(a.name).startsWith(q) ? 0 : 1;
      const bStarts = normalize(b.name).startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    });
    this.suggestions = matches.slice(0, MAX_SUGGESTIONS);

    const exact = this.items.some((i) => normalize(i.name) === q);
    this.showAdd = this.allowCreate && !exact;
    this.addText = this.showAdd ? `Add "${this.displayName()}" as a new ${this.addNoun}` : '';
  }
}