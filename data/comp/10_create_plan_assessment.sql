-- Plan assessment profiles and segments (HGV vs market competitor standards)
CREATE TABLE IF NOT EXISTS workspace.hgv_comp.plan_assessment_profile (
  persona_id STRING NOT NULL,
  plan_id STRING NOT NULL,
  role_title STRING NOT NULL,
  channel_code STRING NOT NULL,
  effective_period STRING NOT NULL
) USING DELTA
COMMENT 'Comp plan assessment header by persona';

CREATE TABLE IF NOT EXISTS workspace.hgv_comp.plan_assessment_segment (
  persona_id STRING NOT NULL,
  effective_period STRING NOT NULL,
  attribute STRING NOT NULL,
  attribute_order INT NOT NULL,
  side STRING NOT NULL,
  segment_order INT NOT NULL,
  segment_label STRING,
  segment_value STRING NOT NULL
) USING DELTA
COMMENT 'HGV vs market plan assessment row segments';
