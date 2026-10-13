--
-- RadarTG Local Relational SQLite Database Dump
-- Exported: 2026-10-13T11:19:54.235Z
-- Host/PC: Local SQLite Engine
--
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- Table structure for: channels
DROP TABLE IF EXISTS channels;
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  username TEXT,
  title TEXT,
  category TEXT,
  active INTEGER,
  priority TEXT,
  parse_interval INTEGER,
  auto_forward INTEGER,
  parsed_count INTEGER,
  last_parsed_at INTEGER,
  last_alert TEXT
);
-- Data for: channels
INSERT INTO channels (id, username, title, category, active, priority, parse_interval, auto_forward, parsed_count, last_parsed_at, last_alert) VALUES ('ch-kpszsu', '@kpszsu', 'Повітряні Сили ЗСУ', 'AIR_FORCE', 1, 'HIGH', 5, 1, 48, 1791890274233, 'Взлет 4х Ту-95мс с аэродрома Оленья');
INSERT INTO channels (id, username, title, category, active, priority, parse_interval, auto_forward, parsed_count, last_parsed_at, last_alert) VALUES ('ch-vanek', '@vanek_nikolaev', 'Николаевский Ванёк', 'RADAR', 1, 'HIGH', 5, 1, 112, 1791890154233, 'Шахеды через Берислав на Снигиревку');
INSERT INTO channels (id, username, title, category, active, priority, parse_interval, auto_forward, parsed_count, last_parsed_at, last_alert) VALUES ('ch-kyiv-alerts', '@kyiv_alerts_oper', 'Оперативный Киев / Радар', 'REGIONAL', 1, 'HIGH', 10, 1, 89, 1791889974233, 'БПЛА на Белую Церковь / Васильков');
INSERT INTO channels (id, username, title, category, active, priority, parse_interval, auto_forward, parsed_count, last_parsed_at, last_alert) VALUES ('ch-dnipro-monitor', '@dnipro_monitor', 'Днепр Монитор & КАБ', 'REGIONAL', 1, 'NORMAL', 15, 1, 63, 1791889674233, 'Угроза КАБ по Запорожскому району');
INSERT INTO channels (id, username, title, category, active, priority, parse_interval, auto_forward, parsed_count, last_parsed_at, last_alert) VALUES ('ch-air-raid-ua', '@air_raid_ua', 'Карта воздушных тревог Украины', 'OFFICIAL', 1, 'NORMAL', 15, 0, 34, 1791889194233, 'Воздушная тревога в Черниговской области');
INSERT INTO channels (id, username, title, category, active, priority, parse_interval, auto_forward, parsed_count, last_parsed_at, last_alert) VALUES ('ch-odesa-oper', '@odesa_operatyvna', 'Одесса Оперативная / Черное Море', 'REGIONAL', 0, 'LOW', 20, 0, 19, 1791887394233, 'Пуски с мыса Тарханкут / Крым');

-- Table structure for: alerts
DROP TABLE IF EXISTS alerts;
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  timestamp INTEGER,
  source_channel TEXT,
  threat_type TEXT,
  severity TEXT,
  regions TEXT,
  vector TEXT,
  status TEXT,
  spam_score INTEGER,
  is_pure_spam INTEGER,
  processing_time_ms REAL,
  cleaned_text TEXT
);
-- Data for: alerts
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('sample-1', 1791890154233, '@kyiv_alerts_oper', 'DRONE', 'CRITICAL', 'Киев, Белая Церковь, Васильков, Киевская обл.', 'Юг -> Северо-Запад, курс на Васильков', 'FORWARDED', 65, 0, 0.8, '🚨 КИЕВ и ОБЛАСТЬ! Внимание!\nГруппа БПЛА "Shahed-136" движется курсом на Белую Церковь / Васильков! Скорость ~185 км/ч.\n\nВнимание: Находитесь в укрыти');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('sample-2', 1791889674233, '@dnipro_monitor', 'AVIATION', 'HIGH', 'Запорожье, Днепр, Днепропетровская обл.', 'Азовское море -> Запорожское направление', 'FORWARDED', 48, 0, 0.8, '⚠️ Внимание! Активность тактической авиации Су-34 над акваторией Азовского моря!\nУгроза пуска управляемых авиабомб (КАБ) по Запорожскому и Днепропетро');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('sample-3', 1791888894233, '@trash_alerts_bot', 'INFO', 'LOW', '', '', 'BLOCKED', 100, 1, 0.8, '');

-- Table structure for: parsing_rules
DROP TABLE IF EXISTS parsing_rules;
CREATE TABLE parsing_rules (
  id TEXT PRIMARY KEY,
  rule_type TEXT,
  pattern TEXT,
  enabled INTEGER,
  description TEXT
);
-- Data for: parsing_rules
INSERT INTO parsing_rules (id, rule_type, pattern, enabled, description) VALUES ('rule_1', 'KEYWORD', 'монобанка', 1, 'Удаление сборов');
INSERT INTO parsing_rules (id, rule_type, pattern, enabled, description) VALUES ('rule_2', 'KEYWORD', 'подпишись', 1, 'Блокировка кликбейта');
INSERT INTO parsing_rules (id, rule_type, pattern, enabled, description) VALUES ('rule_3', 'REGEX', 't\.me\/\+[a-zA-Z0-9]+', 1, 'Пригласительные ссылки');
INSERT INTO parsing_rules (id, rule_type, pattern, enabled, description) VALUES ('rule_4', 'REGEX', 'USDT\s*TRC20', 1, 'Криптокошельки');

-- Table structure for: system_stats
DROP TABLE IF EXISTS system_stats;
CREATE TABLE system_stats (
  metric TEXT PRIMARY KEY,
  value INTEGER
);
-- Data for: system_stats
INSERT INTO system_stats (metric, value) VALUES ('totalParsed', 0);
INSERT INTO system_stats (metric, value) VALUES ('totalBlocked', 0);
INSERT INTO system_stats (metric, value) VALUES ('totalCleaned', 0);
INSERT INTO system_stats (metric, value) VALUES ('totalForwarded', 0);

COMMIT;