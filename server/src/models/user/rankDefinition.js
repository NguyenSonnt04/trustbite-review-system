/**
 * RankDefinitionModel
 * Represents the 'rank_definitions' seed table.
 */
export class RankDefinitionModel {
  constructor(data = {}) {
    this.code = data.code ?? null;
    this.label = data.label ?? null;
    this.min_exp = data.min_exp != null ? parseInt(data.min_exp, 10) : null;
    this.icon_url = data.icon_url ?? null;
    this.description = data.description ?? null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}

