/**
 * AmenityModel
 * Represents the 'amenities' seed table.
 */
export class AmenityModel {
  constructor(data = {}) {
    this.id = data.id != null ? parseInt(data.id, 10) : null;
    this.code = data.code ?? null;
    this.label = data.label ?? null;
    this.icon_url = data.icon_url ?? null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}

