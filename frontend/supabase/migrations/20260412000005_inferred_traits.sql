-- Phase 2-A: Implicit Persona onboarding result storage
-- Stores AI-inferred personality traits from onboarding scenario/quiz

ALTER TABLE clones ADD COLUMN inferred_traits jsonb DEFAULT NULL;

COMMENT ON COLUMN clones.inferred_traits IS 'AI-inferred behavioral patterns from onboarding scenarios/quizzes. NULL if onboarding not completed.';
