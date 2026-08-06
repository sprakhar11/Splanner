-- Rebuild the FTS5 index as a content-storing table.
--
-- 0001 declared it with content='' (contentless). In that mode FTS5 keeps only
-- the inverted index, so:
--   * SELECT entity_type / entity_id returns NULL
--   * snippet() returns NULL
--   * DELETE ... WHERE entity_id = ? matches nothing, because the columns are
--     unreadable, so the AFTER DELETE / AFTER UPDATE triggers leaked orphans
--
-- The result was a search endpoint returning rows of nulls, and an index that
-- had grown to 239 rows against 25 real source rows.
--
-- NOTE: the application also applies this at boot via ensureSearchIndex()
-- in src/server/db/search-index.ts, which is idempotent and self-healing.
-- This file exists so the schema history is complete.

DROP TRIGGER IF EXISTS tasks_ai;
DROP TRIGGER IF EXISTS tasks_au;
DROP TRIGGER IF EXISTS tasks_ad;
DROP TRIGGER IF EXISTS notes_ai;
DROP TRIGGER IF EXISTS notes_au;
DROP TRIGGER IF EXISTS notes_ad;
DROP TRIGGER IF EXISTS revision_items_ai;
DROP TRIGGER IF EXISTS revision_items_au;
DROP TRIGGER IF EXISTS revision_items_ad;
DROP TRIGGER IF EXISTS dsa_problems_ai;
DROP TRIGGER IF EXISTS dsa_problems_au;
DROP TRIGGER IF EXISTS dsa_problems_ad;
DROP TRIGGER IF EXISTS system_design_ai;
DROP TRIGGER IF EXISTS system_design_au;
DROP TRIGGER IF EXISTS system_design_ad;
DROP TRIGGER IF EXISTS lld_designs_ai;
DROP TRIGGER IF EXISTS lld_designs_au;
DROP TRIGGER IF EXISTS lld_designs_ad;
DROP TRIGGER IF EXISTS hr_stories_ai;
DROP TRIGGER IF EXISTS hr_stories_au;
DROP TRIGGER IF EXISTS hr_stories_ad;

DROP TABLE IF EXISTS search_index;

CREATE VIRTUAL TABLE search_index USING fts5(
  entity_type,
  entity_id,
  searchable_text,
  tokenize='porter unicode61'
);

-- ===== TASKS =====
CREATE TRIGGER tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('TASK', NEW.id, NEW.title || ' ' || COALESCE(NEW.description, ''));
END;
CREATE TRIGGER tasks_au AFTER UPDATE ON tasks BEGIN
  DELETE FROM search_index WHERE entity_type = 'TASK' AND entity_id = OLD.id;
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('TASK', NEW.id, NEW.title || ' ' || COALESCE(NEW.description, ''));
END;
CREATE TRIGGER tasks_ad AFTER DELETE ON tasks BEGIN
  DELETE FROM search_index WHERE entity_type = 'TASK' AND entity_id = OLD.id;
END;

-- ===== NOTES =====
CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('NOTE', NEW.id, NEW.title || ' ' || COALESCE(NEW.content, ''));
END;
CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
  DELETE FROM search_index WHERE entity_type = 'NOTE' AND entity_id = OLD.id;
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('NOTE', NEW.id, NEW.title || ' ' || COALESCE(NEW.content, ''));
END;
CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
  DELETE FROM search_index WHERE entity_type = 'NOTE' AND entity_id = OLD.id;
END;

-- ===== REVISION ITEMS =====
CREATE TRIGGER revision_items_ai AFTER INSERT ON revision_items BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('REVISION', NEW.id, NEW.title || ' ' || COALESCE(NEW.concept, ''));
END;
CREATE TRIGGER revision_items_au AFTER UPDATE ON revision_items BEGIN
  DELETE FROM search_index WHERE entity_type = 'REVISION' AND entity_id = OLD.id;
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('REVISION', NEW.id, NEW.title || ' ' || COALESCE(NEW.concept, ''));
END;
CREATE TRIGGER revision_items_ad AFTER DELETE ON revision_items BEGIN
  DELETE FROM search_index WHERE entity_type = 'REVISION' AND entity_id = OLD.id;
END;

-- ===== DSA PROBLEMS =====
CREATE TRIGGER dsa_problems_ai AFTER INSERT ON dsa_problems BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('DSA', NEW.id, NEW.title || ' ' || COALESCE(NEW.category_pattern, '') || ' ' || COALESCE(NEW.mistakes_notes, ''));
END;
CREATE TRIGGER dsa_problems_au AFTER UPDATE ON dsa_problems BEGIN
  DELETE FROM search_index WHERE entity_type = 'DSA' AND entity_id = OLD.id;
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('DSA', NEW.id, NEW.title || ' ' || COALESCE(NEW.category_pattern, '') || ' ' || COALESCE(NEW.mistakes_notes, ''));
END;
CREATE TRIGGER dsa_problems_ad AFTER DELETE ON dsa_problems BEGIN
  DELETE FROM search_index WHERE entity_type = 'DSA' AND entity_id = OLD.id;
END;

-- ===== SYSTEM DESIGN =====
CREATE TRIGGER system_design_ai AFTER INSERT ON system_design BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('SYSTEM_DESIGN', NEW.id, NEW.title || ' ' || COALESCE(NEW.notes, ''));
END;
CREATE TRIGGER system_design_au AFTER UPDATE ON system_design BEGIN
  DELETE FROM search_index WHERE entity_type = 'SYSTEM_DESIGN' AND entity_id = OLD.id;
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('SYSTEM_DESIGN', NEW.id, NEW.title || ' ' || COALESCE(NEW.notes, ''));
END;
CREATE TRIGGER system_design_ad AFTER DELETE ON system_design BEGIN
  DELETE FROM search_index WHERE entity_type = 'SYSTEM_DESIGN' AND entity_id = OLD.id;
END;

-- ===== LLD DESIGNS =====
CREATE TRIGGER lld_designs_ai AFTER INSERT ON lld_designs BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('LLD', NEW.id, NEW.title || ' ' || COALESCE(NEW.description, ''));
END;
CREATE TRIGGER lld_designs_au AFTER UPDATE ON lld_designs BEGIN
  DELETE FROM search_index WHERE entity_type = 'LLD' AND entity_id = OLD.id;
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('LLD', NEW.id, NEW.title || ' ' || COALESCE(NEW.description, ''));
END;
CREATE TRIGGER lld_designs_ad AFTER DELETE ON lld_designs BEGIN
  DELETE FROM search_index WHERE entity_type = 'LLD' AND entity_id = OLD.id;
END;

-- ===== HR STORIES =====
CREATE TRIGGER hr_stories_ai AFTER INSERT ON hr_stories BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('HR', NEW.id, NEW.title || ' ' || COALESCE(NEW.situation, '') || ' ' || COALESCE(NEW.action, '') || ' ' || COALESCE(NEW.result, ''));
END;
CREATE TRIGGER hr_stories_au AFTER UPDATE ON hr_stories BEGIN
  DELETE FROM search_index WHERE entity_type = 'HR' AND entity_id = OLD.id;
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('HR', NEW.id, NEW.title || ' ' || COALESCE(NEW.situation, '') || ' ' || COALESCE(NEW.action, '') || ' ' || COALESCE(NEW.result, ''));
END;
CREATE TRIGGER hr_stories_ad AFTER DELETE ON hr_stories BEGIN
  DELETE FROM search_index WHERE entity_type = 'HR' AND entity_id = OLD.id;
END;

-- ===== Backfill =====
INSERT INTO search_index(entity_type, entity_id, searchable_text)
  SELECT 'TASK', id, title || ' ' || COALESCE(description, '') FROM tasks;
INSERT INTO search_index(entity_type, entity_id, searchable_text)
  SELECT 'NOTE', id, title || ' ' || COALESCE(content, '') FROM notes;
INSERT INTO search_index(entity_type, entity_id, searchable_text)
  SELECT 'REVISION', id, title || ' ' || COALESCE(concept, '') FROM revision_items;
INSERT INTO search_index(entity_type, entity_id, searchable_text)
  SELECT 'DSA', id, title || ' ' || COALESCE(category_pattern, '') || ' ' || COALESCE(mistakes_notes, '') FROM dsa_problems;
INSERT INTO search_index(entity_type, entity_id, searchable_text)
  SELECT 'SYSTEM_DESIGN', id, title || ' ' || COALESCE(notes, '') FROM system_design;
INSERT INTO search_index(entity_type, entity_id, searchable_text)
  SELECT 'LLD', id, title || ' ' || COALESCE(description, '') FROM lld_designs;
INSERT INTO search_index(entity_type, entity_id, searchable_text)
  SELECT 'HR', id, title || ' ' || COALESCE(situation, '') || ' ' || COALESCE(action, '') || ' ' || COALESCE(result, '') FROM hr_stories;
