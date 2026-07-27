# ADR 0011: Phase 3 in-process rule evaluation

Rules run in the collector after successful normalized observations and after collector health changes. This keeps device timing and failure context at the collection boundary, avoids a new queue or Redis dependency, and persists all durable state through the existing repository. Optional metrics remain absent rather than inferred.
