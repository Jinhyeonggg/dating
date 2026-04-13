-- Phase 2-B: Clone 간 관계 기억

CREATE TABLE clone_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clone_id uuid NOT NULL REFERENCES clones(id) ON DELETE CASCADE,
  target_clone_id uuid NOT NULL REFERENCES clones(id) ON DELETE CASCADE,
  interaction_count int NOT NULL DEFAULT 1,
  summary text NOT NULL,
  memories jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clone_id, target_clone_id)
);

-- 인덱스
CREATE INDEX idx_clone_relationships_clone_id ON clone_relationships(clone_id);
CREATE INDEX idx_clone_relationships_pair ON clone_relationships(clone_id, target_clone_id);

-- RLS
ALTER TABLE clone_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their clones' relationships"
  ON clone_relationships FOR SELECT
  USING (clone_id IN (SELECT id FROM clones WHERE user_id = auth.uid()));
