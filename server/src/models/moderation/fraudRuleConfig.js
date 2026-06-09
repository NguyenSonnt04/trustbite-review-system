/**
 * FraudRuleConfigModel
 * Represents the 'fraud_rule_configs' seed/config table.
 */
export class FraudRuleConfigModel {
  constructor(data = {}) {
    this.key = data.key ?? null;
    this.value_numeric = data.value_numeric != null ? parseFloat(data.value_numeric) : null;
    this.value_text = data.value_text ?? null;
    this.description = data.description ?? null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}

