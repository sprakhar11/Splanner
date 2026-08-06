-- FTS5 virtual table for cross-entity search
-- Hand-written (Drizzle doesn't model virtual tables)

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  entity_type,
  entity_id,
  searchable_text,
  content='',
  tokenize='porter unicode61'
);

-- ===== TASKS triggers =====
CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('TASK', NEW.id, NEW.title || ' ' || COALESCE(NEW.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'TASK';
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('TASK', NEW.id, NEW.title || ' ' || COALESCE(NEW.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'TASK';
END;

-- ===== NOTES triggers =====
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('NOTE', NEW.id, NEW.title || ' ' || COALESCE(NEW.content, ''));
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'NOTE';
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('NOTE', NEW.id, NEW.title || ' ' || COALESCE(NEW.content, ''));
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'NOTE';
END;

-- ===== REVISION ITEMS triggers =====
CREATE TRIGGER IF NOT EXISTS revision_items_ai AFTER INSERT ON revision_items BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('REVISION', NEW.id, NEW.title || ' ' || COALESCE(NEW.concept, ''));
END;

CREATE TRIGGER IF NOT EXISTS revision_items_au AFTER UPDATE ON revision_items BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'REVISION';
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('REVISION', NEW.id, NEW.title || ' ' || COALESCE(NEW.concept, ''));
END;

CREATE TRIGGER IF NOT EXISTS revision_items_ad AFTER DELETE ON revision_items BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'REVISION';
END;

-- ===== DSA PROBLEMS triggers =====
CREATE TRIGGER IF NOT EXISTS dsa_problems_ai AFTER INSERT ON dsa_problems BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('DSA', NEW.id, NEW.title || ' ' || COALESCE(NEW.category_pattern, '') || ' ' || COALESCE(NEW.mistakes_notes, ''));
END;

CREATE TRIGGER IF NOT EXISTS dsa_problems_au AFTER UPDATE ON dsa_problems BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'DSA';
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('DSA', NEW.id, NEW.title || ' ' || COALESCE(NEW.category_pattern, '') || ' ' || COALESCE(NEW.mistakes_notes, ''));
END;

CREATE TRIGGER IF NOT EXISTS dsa_problems_ad AFTER DELETE ON dsa_problems BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'DSA';
END;

-- ===== SYSTEM DESIGN triggers =====
CREATE TRIGGER IF NOT EXISTS system_design_ai AFTER INSERT ON system_design BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('SYSTEM_DESIGN', NEW.id, NEW.title || ' ' || COALESCE(NEW.notes, ''));
END;

CREATE TRIGGER IF NOT EXISTS system_design_au AFTER UPDATE ON system_design BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'SYSTEM_DESIGN';
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('SYSTEM_DESIGN', NEW.id, NEW.title || ' ' || COALESCE(NEW.notes, ''));
END;

CREATE TRIGGER IF NOT EXISTS system_design_ad AFTER DELETE ON system_design BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'SYSTEM_DESIGN';
END;

-- ===== LLD DESIGNS triggers =====
CREATE TRIGGER IF NOT EXISTS lld_designs_ai AFTER INSERT ON lld_designs BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('LLD', NEW.id, NEW.title || ' ' || COALESCE(NEW.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS lld_designs_au AFTER UPDATE ON lld_designs BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'LLD';
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('LLD', NEW.id, NEW.title || ' ' || COALESCE(NEW.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS lld_designs_ad AFTER DELETE ON lld_designs BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'LLD';
END;

-- ===== HR STORIES triggers =====
CREATE TRIGGER IF NOT EXISTS hr_stories_ai AFTER INSERT ON hr_stories BEGIN
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('HR', NEW.id, NEW.title || ' ' || COALESCE(NEW.situation, '') || ' ' || COALESCE(NEW.result, ''));
END;

CREATE TRIGGER IF NOT EXISTS hr_stories_au AFTER UPDATE ON hr_stories BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'HR';
  INSERT INTO search_index(entity_type, entity_id, searchable_text)
  VALUES ('HR', NEW.id, NEW.title || ' ' || COALESCE(NEW.situation, '') || ' ' || COALESCE(NEW.result, ''));
END;

CREATE TRIGGER IF NOT EXISTS hr_stories_ad AFTER DELETE ON hr_stories BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'HR';
END;
