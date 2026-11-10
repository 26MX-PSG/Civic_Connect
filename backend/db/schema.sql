-- CivicConnect MySQL schema (DESIGN.md section 7). Safe to re-run: drops and recreates all tables.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notifications, feedback, search_queries, saved_schemes, profiles,
  scheme_documents, scheme_criteria, scheme_aliases, schemes, documents, faqs, categories, users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  user_id             INT PRIMARY KEY AUTO_INCREMENT,
  name                VARCHAR(100) NOT NULL,
  email               VARCHAR(150) NOT NULL UNIQUE,
  password_hash       VARCHAR(100) NOT NULL,
  role                ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER',
  preferred_language  ENUM('EN','TA') NOT NULL DEFAULT 'EN',
  email_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  category_id INT PRIMARY KEY AUTO_INCREMENT,
  slug        VARCHAR(60) NOT NULL UNIQUE,
  icon        VARCHAR(40) NULL,
  name_en     VARCHAR(100) NOT NULL,
  name_ta     VARCHAR(150) NULL,
  description TEXT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE documents (
  document_id     VARCHAR(40) PRIMARY KEY,
  name_en         VARCHAR(150) NOT NULL,
  name_ta         VARCHAR(150) NULL,
  description     TEXT NULL,
  where_to_get    TEXT NULL,
  where_to_get_ta TEXT NULL,
  issuer_url      VARCHAR(500) NULL,
  issuer_label    VARCHAR(100) NULL
);

CREATE TABLE schemes (
  scheme_id        INT PRIMARY KEY AUTO_INCREMENT,
  slug             VARCHAR(80) NOT NULL UNIQUE,
  category_id      INT NOT NULL,
  level            ENUM('CENTRAL','STATE') NOT NULL,
  state            VARCHAR(60) NULL,
  image            VARCHAR(60) NULL,
  name_en          VARCHAR(200) NOT NULL,
  name_ta          VARCHAR(250) NULL,
  short_en         TEXT NULL,
  short_ta         TEXT NULL,
  who_en           TEXT NULL,
  who_ta           TEXT NULL,
  benefits_en      JSON NULL,
  benefits_ta      JSON NULL,
  official_url     VARCHAR(500) NULL,
  source_name      VARCHAR(200) NULL,
  source_url       VARCHAR(500) NULL,
  last_verified_on DATE NULL,
  is_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (category_id) REFERENCES categories(category_id),
  INDEX idx_schemes_category (category_id),
  INDEX idx_schemes_active (is_active, level, state)
);

CREATE TABLE scheme_aliases (
  alias_id  INT PRIMARY KEY AUTO_INCREMENT,
  scheme_id INT NOT NULL,
  alias     VARCHAR(100) NOT NULL,
  FOREIGN KEY (scheme_id) REFERENCES schemes(scheme_id) ON DELETE CASCADE
);

-- Criteria in the same criteria_group are ANDed; a scheme matches if any group passes (OR).
CREATE TABLE scheme_criteria (
  criteria_id    INT PRIMARY KEY AUTO_INCREMENT,
  scheme_id      INT NOT NULL,
  criteria_group INT NOT NULL DEFAULT 1,
  type           VARCHAR(40) NOT NULL,
  op             VARCHAR(10) NOT NULL,
  value          VARCHAR(100) NOT NULL DEFAULT '',
  label_en       VARCHAR(200) NULL,
  label_ta       VARCHAR(250) NULL,
  FOREIGN KEY (scheme_id) REFERENCES schemes(scheme_id) ON DELETE CASCADE
);

CREATE TABLE scheme_documents (
  scheme_id    INT NOT NULL,
  document_id  VARCHAR(40) NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (scheme_id, document_id),
  FOREIGN KEY (scheme_id) REFERENCES schemes(scheme_id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(document_id)
);

CREATE TABLE faqs (
  faq_id      INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NULL,
  topic       VARCHAR(40) NULL,
  question_en TEXT NOT NULL,
  answer_en   TEXT NOT NULL,
  question_ta TEXT NULL,
  answer_ta   TEXT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE profiles (
  user_id            INT PRIMARY KEY,
  dob                DATE NULL,
  gender             VARCHAR(30) NULL,
  income             INT NULL,
  occupation         VARCHAR(30) NULL,
  state              VARCHAR(60) NULL,
  district           VARCHAR(80) NULL,
  student_level      VARCHAR(30) NULL,
  farmer_land_status VARCHAR(30) NULL,
  disability_type    VARCHAR(30) NULL,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE saved_schemes (
  user_id    INT NOT NULL,
  scheme_id  INT NOT NULL,
  saved_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, scheme_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (scheme_id) REFERENCES schemes(scheme_id) ON DELETE CASCADE
);

-- Search and chatbot questions that found nothing (reviewed by admins)
CREATE TABLE search_queries (
  query_id      INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT NULL,
  query_text    VARCHAR(255) NOT NULL,
  source        ENUM('SEARCH','CHATBOT_GENERAL','CHATBOT_SCHEME') NOT NULL DEFAULT 'SEARCH',
  scheme_id     INT NULL,
  result_found  BOOLEAN NOT NULL DEFAULT FALSE,
  review_status ENUM('NEW','REVIEWED','SCHEME_ADDED','IGNORED') NOT NULL DEFAULT 'NEW',
  count         INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (scheme_id) REFERENCES schemes(scheme_id) ON DELETE SET NULL,
  INDEX idx_sq_text (query_text, source)
);

-- One row per vote. user_id is NULL only for seeded demo votes. A user has one vote per scheme.
CREATE TABLE feedback (
  feedback_id INT PRIMARY KEY AUTO_INCREMENT,
  scheme_id   INT NOT NULL,
  user_id     INT NULL,
  useful      BOOLEAN NOT NULL,
  comment     VARCHAR(200) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_feedback_user_scheme (scheme_id, user_id),
  FOREIGN KEY (scheme_id) REFERENCES schemes(scheme_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE notifications (
  notification_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id         INT NOT NULL,
  scheme_id       INT NULL,
  type            ENUM('SCHEME_UPDATED','SCHEME_DEACTIVATED','NEW_MATCH','ANNOUNCEMENT') NOT NULL,
  title_en        VARCHAR(200) NOT NULL,
  title_ta        VARCHAR(250) NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (scheme_id) REFERENCES schemes(scheme_id) ON DELETE SET NULL,
  INDEX idx_notif_user (user_id, is_read)
);
