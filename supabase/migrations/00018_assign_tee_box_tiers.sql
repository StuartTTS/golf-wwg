-- Assign tier values to tee boxes based on name patterns.
-- Tiers: 1 = championship/longest, 2 = middle, 3 = senior/standard, 4 = forward/shortest.
-- The wizard's "Use Preferred Tees" feature matches players' default_tee_tier to tee_box.tier.

UPDATE tee_boxes SET tier = 1 WHERE tier IS NULL AND (
  name ILIKE 'black%' OR name ILIKE 'double spades%'
);

UPDATE tee_boxes SET tier = 2 WHERE tier IS NULL AND (
  name ILIKE 'blue%' OR name ILIKE 'spades%'
);

UPDATE tee_boxes SET tier = 3 WHERE tier IS NULL AND (
  name ILIKE 'white%' OR name ILIKE 'copper%'
  OR name ILIKE 'gold%' OR name ILIKE 'clubs%'
  OR name ILIKE 'hearts%'
);

UPDATE tee_boxes SET tier = 4 WHERE tier IS NULL AND (
  name ILIKE 'silver%' OR name ILIKE 'green%'
  OR name ILIKE 'diamonds%' OR name ILIKE 'junior%'
);

-- Catch-all: set any remaining NULL tiers to 3 (middle)
UPDATE tee_boxes SET tier = 3 WHERE tier IS NULL;
