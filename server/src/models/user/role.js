/**
 * RoleModel
 * Represents the 'roles' seed table.
 */
export class RoleModel {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.label = data.label ?? null;
    this.description = data.description ?? null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}

