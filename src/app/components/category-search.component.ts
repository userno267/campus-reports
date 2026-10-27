import { Component, Input, Output, EventEmitter, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonInput, IonList, IonItem, IonLabel, IonButton } from '@ionic/angular';
import { Category } from '../models/report.model';

@Component({
  selector: 'app-category-search',
  standalone: true,
  imports: [CommonModule, FormsModule, IonInput, IonList, IonItem, IonLabel, IonButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <ion-input 
        label="Search Category" 
        labelPlacement="floating"
        [(ngModel)]="searchText" 
        (ionInput)="onSearch($event)"
        placeholder="Type to search...">
      </ion-input>

      @if (filteredCategories.length > 0 && searchText) {
        <ion-list class="category-dropdown">
          @for (cat of filteredCategories; track cat.id) {
            <ion-item button (click)="selectCategory(cat)">
              <ion-label>{{ cat.name }}</ion-label>
            </ion-item>
          }
        </ion-list>
      }

      @if (selectedCategory) {
        <div class="selected-category">
          <strong>Selected:</strong> {{ selectedCategory.name }}
          <ion-button size="small" fill="clear" (click)="clearSelection()">Clear</ion-button>
        </div>
      }
    </div>
  `,
  styles: [`
    .category-dropdown {
      border: 1px solid #ccc;
      border-radius: 4px;
      max-height: 200px;
      overflow-y: auto;
      margin-top: 5px;
    }
    .selected-category {
      padding: 10px;
      margin-top: 10px;
      background-color: #f0f0f0;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  `],
})
export class CategorySearchComponent implements OnInit {
  @Input() categories: Category[] = [];
  @Output() categorySelected = new EventEmitter<number | null>();

  searchText = '';
  filteredCategories: Category[] = [];
  selectedCategory: Category | null = null;
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {}

  onSearch(event: any) {
    const query = (event.detail.value || '').toLowerCase();
    
    if (!query) {
      this.filteredCategories = [];
    } else {
      this.filteredCategories = this.categories.filter(cat =>
        cat.name.toLowerCase().includes(query)
      );
    }
    this.cdr.markForCheck();
  }

  selectCategory(cat: Category) {
    this.selectedCategory = cat;
    this.searchText = cat.name;
    this.filteredCategories = [];
    this.categorySelected.emit(cat.id);
    this.cdr.markForCheck();
  }

  clearSelection() {
    this.selectedCategory = null;
    this.searchText = '';
    this.filteredCategories = [];
    this.categorySelected.emit(null);
    this.cdr.markForCheck();
  }
}