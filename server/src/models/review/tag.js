/**
 * TagModel
 * Represents the 'tags' seed table.
 */
export class TagModel {
  constructor(data = {}) {
    this.id = data.id != null ? parseInt(data.id, 10) : null;
    this.code = data.code ?? null;
    this.label = data.label ?? null;
    this.category = data.category ?? null; // 'REVIEW' | 'MENU_ITEM'
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}

