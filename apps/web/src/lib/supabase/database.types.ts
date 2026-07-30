// Single source of truth for DB schema types lives in @golf/core.
// This file re-exports it so existing `@/lib/supabase/database.types` imports
// keep working. Regenerate the types in packages/core, not here.
export * from '@golf/core/src/types/database.generated';
