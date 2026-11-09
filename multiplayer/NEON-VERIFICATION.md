# Neon persistence verification (read-only)

Run these queries in the Neon SQL Editor for the database used by Render's
`DATABASE_URL`. They do **not** change or delete records. Never share your
database connection string or private survivor recovery key.

## 1. Confirm tables exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('last_light_matches','last_light_profiles','last_light_profile_events')
ORDER BY table_name;
```

All three names should appear after the game has initialized each store.

## 2. Confirm saved match results and role names

```sql
SELECT match_id, completed_at, outcome, floors_cleared,
       ROUND(elapsed_seconds::numeric, 2) AS elapsed_seconds,
       competitive, players, achievements
FROM last_light_matches
ORDER BY completed_at DESC LIMIT 10;
```

A legitimate completed 27-floor run should show `outcome='victory'` and
`competitive=true`. Runs using the developer skip should not qualify.

## 3. Confirm leaderboard record integrity

```sql
SELECT match_id, room_name, elapsed_seconds,
       jsonb_array_length(players) AS player_count, players
FROM last_light_matches
WHERE competitive = TRUE AND outcome='victory' AND floors_cleared=27
  AND jsonb_typeof(players)='array'
ORDER BY elapsed_seconds ASC, completed_at ASC LIMIT 20;
```

## 4. Confirm survivor progression exists (no secrets displayed)

```sql
SELECT COUNT(*) AS profiles,
       COALESCE(SUM(attempts),0) AS recorded_attempts,
       MAX(best_floors) AS highest_floor,
       MIN(best_time) AS fastest_time
FROM last_light_profiles;
```

## 5. Confirm event deduplication

```sql
SELECT COUNT(*) AS stored_events,
       COUNT(DISTINCT event_id) AS unique_events
FROM last_light_profile_events;
```

The two counts should match.

## 6. Restart verification

1. Note the results of queries 2 and 4.
2. Redeploy or restart the Render service (without changing its database URL).
3. Check `/health` once the service is ready.
4. Run queries 2 and 4 again, and refresh the in-game leaderboard.
5. The existing match results and progress totals should be unchanged.

This procedure checks persistent *completed* records and survivor profiles.
It does not imply live rooms or unfinished matches can resume after a full
server restart. Those are held in the running server process.
