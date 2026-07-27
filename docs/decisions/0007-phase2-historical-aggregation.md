# ADR 0007: PostgreSQL-first historical aggregation

Raw samples are returned for ranges up to six hours. Longer ranges use PostgreSQL `date_bin` buckets: 60 seconds for 24 hours, 900 seconds for seven days, and 3,600 seconds for 30 days. Each bucket returns minimum, maximum, average, latest, and sample count. Gaps remain absent; no interpolation is performed.
