--
-- RadarTG Local Relational SQLite Database Dump
-- Exported: 2026-10-15T16:46:46.239Z
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
INSERT INTO channels (id, username, title, category, active, priority, parse_interval, auto_forward, parsed_count, last_parsed_at, last_alert) VALUES ('ch-1792074073761-98', '@kpszsu', 'Повітряні Сили ЗС України / Air Force of the Armed Forces of Ukraine', 'AIR_FORCE', 1, 'HIGH', 2, 1, 48, 1792082806105, '🛵 Волинська область - БпЛА на Маневичі, Колки');
INSERT INTO channels (id, username, title, category, active, priority, parse_interval, auto_forward, parsed_count, last_parsed_at, last_alert) VALUES ('ch-1792070897881-137', '@zahid_informue', 'Захід Інформує', 'OFFICIAL', 1, 'HIGH', 2, 1, 33, 1792082806170, '1 на Камінь-Каширський');
INSERT INTO channels (id, username, title, category, active, priority, parse_interval, auto_forward, parsed_count, last_parsed_at, last_alert) VALUES ('ch-1792070816911-502', '@UkraineAlarmSignal', 'єТривога', 'OFFICIAL', 1, 'HIGH', 2, 1, 185, 1792082806238, '🛸 Солом’янка (Київ)\nЗагроза застосування БПЛА. Перейдіть в укриття!');

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
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082801000-43', 1792082801000, '@kpszsu', 'DRONE', 'HIGH', 'Сектор уточняется', 'Курс уточняется', 'PENDING', 0, 0, 0.27, '🛵 Волинська область - БпЛА на Маневичі, Колки');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082793569-317', 1792082793569, '@zahid_informue', 'INFO', 'LOW', 'Сектор уточняется', 'Курс уточняется', 'PENDING', 0, 0, 0.27, '1 на Камінь-Каширський');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082735951-747', 1792082735951, '@kpszsu', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.13, '🏍 Київ: реактивний БпЛА  на Позняки');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082723514-327', 1792082723514, '@zahid_informue', 'INFO', 'LOW', 'Волынь', 'Курс в сектор Волынь', 'PENDING', 0, 0, 0.21, '✈️ Волинь:\n1 на Камінь-Каширський\n1 на Колки');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082668440-874', 1792082668440, '@kpszsu', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.59, '🏍 Київ: реактивний БпЛА  на Печерськ');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082638554-230', 1792082638554, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.81, '🛸 Солом’янка (Київ)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082618396-563', 1792082618396, '@kpszsu', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 1.14, '🏍 Київ: реактивний БпЛА  на Солом''янку');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082566261-434', 1792082566261, '@kpszsu', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 1.94, '🏍 Київ: реактивний БпЛА  на Борщагівку');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082565901-525', 1792082565901, '@kpszsu', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 3.89, '🏍 Київ: реактивний БпЛА  на Вишневе');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082523831-647', 1792082523831, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 2.15, '🛸 Позняки (Київ)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082523826-345', 1792082523826, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Винница', 'Курс в сектор Винница', 'PENDING', 0, 0, 4.38, '🛸 Шаргород (Вінницька обл.)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082449920-247', 1792082449920, '@zahid_informue', 'INFO', 'LOW', 'Ровно', 'Курс в сектор Ровно', 'PENDING', 0, 0, 0.12, '🚀 Реактивний на Дубровицю (Рівненщина)');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082434769-28', 1792082434769, '@kpszsu', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.08, '🏍 Київ: реактивний БпЛА  на Позняки');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082434765-593', 1792082434765, '@kpszsu', 'DRONE', 'HIGH', 'Сектор уточняется', 'курсом на Шаргород', 'PENDING', 0, 0, 0.16, '🏍 Вінничина: реактивний БпЛА повз н.п.Джурин курсом на Шаргород');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082335054-177', 1792082335054, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.14, '🛸 Жуляни (Київ)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082334871-480', 1792082334871, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.11, '🛸 Дарниця (Київ)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082329862-92', 1792082329862, '@zahid_informue', 'INFO', 'LOW', 'Сектор уточняется', 'Курс уточняется', 'PENDING', 0, 0, 0.06, '‼️ На Маневичі');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082329860-582', 1792082329860, '@zahid_informue', 'INFO', 'LOW', 'Тернополь', 'Курс в сектор Тернополь', 'PENDING', 0, 0, 0.32, '🔴Тернопільський район — оголошено повітряну тривогу!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082319741-63', 1792082319741, '@kpszsu', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.35, '🏍 Київ: реактивні БпЛА  над містом');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082272442-179', 1792082272442, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Хмельницкий', 'Курс в сектор Хмельницкий', 'FORWARDED', 0, 0, 0.12, '🛸 Дунаївці (Хмельницька обл.)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082272370-290', 1792082272370, '@zahid_informue', 'INFO', 'LOW', 'Ровно', 'Курс в сектор Ровно', 'PENDING', 0, 0, 0.07, '🚀 Реактивний на Дубровицю (Рівненщина)');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082272368-264', 1792082272368, '@zahid_informue', 'INFO', 'LOW', 'Сектор уточняется', 'Курс уточняется', 'PENDING', 0, 0, 0.07, '‼️ На Маневичі');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082272366-912', 1792082272366, '@zahid_informue', 'INFO', 'LOW', 'Тернополь', 'Курс в сектор Тернополь', 'PENDING', 0, 0, 0.11, '🔴Тернопільський район — оголошено повітряну тривогу!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082264758-153', 1792082264758, '@kpszsu', 'DRONE', 'HIGH', 'Сектор уточняется', 'Курс уточняется', 'PENDING', 0, 0, 0.18, '🏍 Реактивний БпЛА на Хмельниччині курсом на н.п.Дунаївці');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082220248-149', 1792082220248, '@UkraineAlarmSignal', 'INFO', 'LOW', 'Тернополь', 'Курс в сектор Тернополь', 'PENDING', 0, 0, 0.21, '🟡 Жовтий рівень тривоги\n• Тернопільський район (Тернопільська обл.)\n• Чортківський район (Тернопільська обл.)');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082220063-837', 1792082220063, '@UkraineAlarmSignal', 'AIR_RAID', 'MEDIUM', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.17, '🟡 Білоцерківський район (Київська обл.)\nЖовтий рівень тривоги. Прямуйте в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082219860-343', 1792082219860, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.12, '🛸 Глеваха (Київська обл.)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082209866-669', 1792082209866, '@zahid_informue', 'INFO', 'LOW', 'Волынь', 'Курс в сектор Волынь', 'PENDING', 0, 0, 0.16, '🚀 Волинь,  залишився цей на Колки');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082152316-833', 1792082152316, '@zahid_informue', 'INFO', 'LOW', 'Сектор уточняется', 'Курс уточняется', 'PENDING', 0, 0, 0.11, '1 на Маневичі/Колки');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082149812-623', 1792082149812, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.16, '🛸 Васильків (Київська обл.)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082139689-772', 1792082139689, '@kpszsu', 'DRONE', 'HIGH', 'Волынь', 'курсом на місто з півночі', 'PENDING', 0, 0, 0.12, '🏍 Луцьк: реактивний БпЛА курсом на місто з півночі');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082089905-778', 1792082089905, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.13, '🛸 Боярка (Київська обл.)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082089847-884', 1792082089847, '@zahid_informue', 'INFO', 'LOW', 'Сектор уточняется', 'Курс уточняется', 'PENDING', 0, 0, 0.1, '1 на Луць');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082072174-410', 1792082072174, '@kpszsu', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.07, '🏍 Київщина: реактивний БпЛА на Боярку');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082072172-360', 1792082072172, '@kpszsu', 'DRONE', 'HIGH', 'Сектор уточняется', 'Курс уточняется', 'PENDING', 0, 0, 0.13, '🏍 Реактивний БпЛА на Вінничині, курс н.п.Томашпіль');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082037456-423', 1792082037456, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.12, '🛸 Вишневе (Київська обл.)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082037263-130', 1792082037263, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.11, '🛸 Борщагівка (Київ)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082022330-374', 1792082022330, '@kpszsu', 'DRONE', 'HIGH', 'Волынь', 'курсом на місто з півночі', 'PENDING', 0, 0, 0.09, '🏍 Луцьк: реактивний БпЛА курсом на місто з півночі');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792082022163-819', 1792082022163, '@kpszsu', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.11, '🏍 Київ: реактивний БпЛА  на Борщагівку');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792081972475-577', 1792081972475, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.2, '🛸 Чоколівка (Київ)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792081972279-620', 1792081972279, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.14, '🛸 Лук’янівка (Київ)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792081972277-805', 1792081972277, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Волынь', 'Курс в сектор Волынь', 'PENDING', 0, 0, 0.12, '🛸 Луцьк (Волинська обл.)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792081954944-322', 1792081954944, '@zahid_informue', 'INFO', 'LOW', 'Сектор уточняется', 'Курс уточняется', 'PENDING', 0, 0, 0.06, '‼️ Підгайці');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792081954942-361', 1792081954942, '@zahid_informue', 'AIR_RAID', 'MEDIUM', 'Волынь', 'Курс в сектор Волынь', 'PENDING', 2, 0, 0.14, '✈️ Луцьк, підлітає\nнегайно в укриття!\nвсі відійшли від АЗС/ТРЦ/НП');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792081954646-792', 1792081954646, '@kpszsu', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.13, '🏍 Київ: реактивний БпЛА  на Шулявку');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792081904103-491', 1792081904103, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.11, '🛸 Поділ (Київ)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792081903879-564', 1792081903879, '@UkraineAlarmSignal', 'DRONE', 'HIGH', 'Киев', 'Курс в сектор Киев', 'PENDING', 0, 0, 0.19, '🛸 Русанівка (Київ)\nЗагроза застосування БПЛА. Перейдіть в укриття!');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792081889634-537', 1792081889634, '@kpszsu', 'DRONE', 'HIGH', 'Волынь', 'курсом на місто', 'PENDING', 0, 0, 0.17, '🏍 Луцьк: реактивний БпЛА курсом на місто');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792081887246-598', 1792081887246, '@zahid_informue', 'INFO', 'LOW', 'Волынь', 'Курс в сектор Волынь', 'PENDING', 0, 0, 0.12, '🚀 Волинь:\n1 на Маневичі/Колки\n1 на Луцьк');
INSERT INTO alerts (id, timestamp, source_channel, threat_type, severity, regions, vector, status, spam_score, is_pure_spam, processing_time_ms, cleaned_text) VALUES ('alert-1792081837245-671', 1792081837245, '@UkraineAlarmSignal', 'AIR_RAID', 'MEDIUM', 'Николаев', 'Курс в сектор Николаев', 'PENDING', 0, 0, 0.11, '🟡 Вознесенський район (Миколаївська обл.)\nЖовтий рівень тривоги. Прямуйте в укриття!');

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