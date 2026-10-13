// Local In-Memory & File-Backed SQL Relational Engine for RadarTG
// Zero native C++ dependencies - works on Windows, Linux, Mac host & in-browser or Node.js

export interface SqlQueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTimeMs: number;
  query: string;
  error?: string;
}

export interface SqlColumnDef {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
  isPrimary?: boolean;
}

export interface SqlTable {
  name: string;
  columns: SqlColumnDef[];
  rows: Record<string, any>[];
}

export class LocalSqlEngine {
  private tables: Map<string, SqlTable> = new Map();

  constructor() {
    this.initDefaultSchema();
  }

  public initDefaultSchema() {
    this.tables.set('channels', {
      name: 'channels',
      columns: [
        { name: 'id', type: 'TEXT', isPrimary: true },
        { name: 'username', type: 'TEXT' },
        { name: 'title', type: 'TEXT' },
        { name: 'category', type: 'TEXT' },
        { name: 'active', type: 'INTEGER' },
        { name: 'priority', type: 'TEXT' },
        { name: 'parse_interval', type: 'INTEGER' },
        { name: 'auto_forward', type: 'INTEGER' },
        { name: 'parsed_count', type: 'INTEGER' },
        { name: 'last_parsed_at', type: 'INTEGER' },
        { name: 'last_alert', type: 'TEXT' },
      ],
      rows: [],
    });

    this.tables.set('alerts', {
      name: 'alerts',
      columns: [
        { name: 'id', type: 'TEXT', isPrimary: true },
        { name: 'timestamp', type: 'INTEGER' },
        { name: 'source_channel', type: 'TEXT' },
        { name: 'threat_type', type: 'TEXT' },
        { name: 'severity', type: 'TEXT' },
        { name: 'regions', type: 'TEXT' },
        { name: 'vector', type: 'TEXT' },
        { name: 'status', type: 'TEXT' },
        { name: 'spam_score', type: 'INTEGER' },
        { name: 'is_pure_spam', type: 'INTEGER' },
        { name: 'processing_time_ms', type: 'REAL' },
        { name: 'cleaned_text', type: 'TEXT' },
      ],
      rows: [],
    });

    this.tables.set('parsing_rules', {
      name: 'parsing_rules',
      columns: [
        { name: 'id', type: 'TEXT', isPrimary: true },
        { name: 'rule_type', type: 'TEXT' },
        { name: 'pattern', type: 'TEXT' },
        { name: 'enabled', type: 'INTEGER' },
        { name: 'description', type: 'TEXT' },
      ],
      rows: [
        { id: 'rule_1', rule_type: 'KEYWORD', pattern: 'монобанка', enabled: 1, description: 'Удаление сборов' },
        { id: 'rule_2', rule_type: 'KEYWORD', pattern: 'подпишись', enabled: 1, description: 'Блокировка кликбейта' },
        { id: 'rule_3', rule_type: 'REGEX', pattern: 't\\.me\\/\\+[a-zA-Z0-9]+', enabled: 1, description: 'Пригласительные ссылки' },
        { id: 'rule_4', rule_type: 'REGEX', pattern: 'USDT\\s*TRC20', enabled: 1, description: 'Криптокошельки' },
      ],
    });

    this.tables.set('system_stats', {
      name: 'system_stats',
      columns: [
        { name: 'metric', type: 'TEXT', isPrimary: true },
        { name: 'value', type: 'INTEGER' },
      ],
      rows: [
        { metric: 'totalParsed', value: 0 },
        { metric: 'totalBlocked', value: 0 },
        { metric: 'totalCleaned', value: 0 },
        { metric: 'totalForwarded', value: 0 },
      ],
    });
  }

  public syncChannelsFromMemory(channels: any[]) {
    const table = this.tables.get('channels');
    if (!table) return;
    table.rows = channels.map((c) => ({
      id: c.id,
      username: c.username,
      title: c.title,
      category: c.category,
      active: c.active ? 1 : 0,
      priority: c.priority || 'NORMAL',
      parse_interval: c.parseIntervalSeconds || 10,
      auto_forward: c.autoForward ? 1 : 0,
      parsed_count: c.parsedMessagesCount || 0,
      last_parsed_at: c.lastParsedAt || null,
      last_alert: c.lastAlertDetected || null,
    }));
  }

  public syncAlertsFromMemory(alerts: any[]) {
    const table = this.tables.get('alerts');
    if (!table) return;
    table.rows = alerts.map((a) => ({
      id: a.id,
      timestamp: a.timestamp,
      source_channel: a.sourceChannel,
      threat_type: a.threatType,
      severity: a.severity,
      regions: Array.isArray(a.regions) ? a.regions.join(', ') : a.regions,
      vector: a.vector || '',
      status: a.status,
      spam_score: a.spamScore || 0,
      is_pure_spam: a.isPureSpam ? 1 : 0,
      processing_time_ms: a.processingTimeMs || 0.8,
      cleaned_text: a.cleanedText ? a.cleanedText.slice(0, 150) : '',
    }));
  }

  public getTables(): Array<{ name: string; columns: SqlColumnDef[]; rowCount: number }> {
    return Array.from(this.tables.values()).map((t) => ({
      name: t.name,
      columns: t.columns,
      rowCount: t.rows.length,
    }));
  }

  public execute(rawQuery: string): SqlQueryResult {
    const startTime = performance.now();
    const query = rawQuery.trim();
    if (!query) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        query,
        error: 'Пустой SQL запрос',
      };
    }

    try {
      const upper = query.toUpperCase();

      // 1. SHOW TABLES
      if (upper === 'SHOW TABLES' || upper === 'SHOW TABLES;' || upper === '.TABLES') {
        const columns = ['name', 'columns_count', 'rows_count'];
        const rows = Array.from(this.tables.values()).map((t) => [
          t.name,
          t.columns.length,
          t.rows.length,
        ]);
        return {
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
          query,
        };
      }

      // 2. PRAGMA table_info(name) or DESCRIBE name
      const describeMatch = query.match(/(?:DESCRIBE|PRAGMA\s+table_info\(?)\s*([a-zA-Z0-9_]+)\)?/i);
      if (describeMatch) {
        const tableName = describeMatch[1].toLowerCase();
        const table = this.tables.get(tableName);
        if (!table) throw new Error(`Таблица '${tableName}' не найдена в базе данных`);
        const columns = ['cid', 'name', 'type', 'pk'];
        const rows = table.columns.map((col, idx) => [idx, col.name, col.type, col.isPrimary ? 1 : 0]);
        return {
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
          query,
        };
      }

      // 3. SELECT query
      if (upper.startsWith('SELECT')) {
        return this.executeSelect(query, startTime);
      }

      // 4. INSERT INTO query
      if (upper.startsWith('INSERT INTO')) {
        return this.executeInsert(query, startTime);
      }

      // 5. UPDATE query
      if (upper.startsWith('UPDATE')) {
        return this.executeUpdate(query, startTime);
      }

      // 6. DELETE query
      if (upper.startsWith('DELETE FROM') || upper.startsWith('DELETE')) {
        return this.executeDelete(query, startTime);
      }

      // Fallback
      throw new Error(`Неподдерживаемая SQL инструкция: ${query.slice(0, 30)}...`);
    } catch (err: any) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
        query,
        error: err.message,
      };
    }
  }

  private executeSelect(query: string, startTime: number): SqlQueryResult {
    // Regex extract parts: SELECT <fields> FROM <table|tables> [WHERE <condition>] [GROUP BY <field>] [ORDER BY <field>] [LIMIT <n>]
    const selectRegex = /SELECT\s+([\s\S]+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+GROUP\s+BY\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+(\d+))?;?$/i;
    const match = query.match(selectRegex);

    if (!match) {
      throw new Error("Синтаксическая ошибка в SELECT запросе. Пример: SELECT * FROM channels WHERE active = 1;");
    }

    const [, rawFields, rawTable, rawWhere, rawGroupBy, rawOrderBy, rawLimit] = match;
    const tableName = rawTable.trim().toLowerCase();
    const table = this.tables.get(tableName);

    if (!table) {
      throw new Error(`Таблица '${tableName}' не существует в базе. Доступны: ${Array.from(this.tables.keys()).join(', ')}`);
    }

    let resultRows = [...table.rows];

    // Filter WHERE
    if (rawWhere) {
      resultRows = resultRows.filter((row) => this.evalWhere(row, rawWhere));
    }

    // GROUP BY handling
    if (rawGroupBy) {
      const groupCol = rawGroupBy.trim();
      const groups = new Map<string, any[]>();
      for (const row of resultRows) {
        const key = String(row[groupCol] ?? 'NULL');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }

      const projectedRows: any[][] = [];
      const columns = [groupCol, 'count'];
      for (const [key, items] of groups.entries()) {
        projectedRows.push([key, items.length]);
      }

      return {
        columns,
        rows: projectedRows,
        rowCount: projectedRows.length,
        executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
        query,
      };
    }

    // ORDER BY
    if (rawOrderBy) {
      const parts = rawOrderBy.trim().split(/\s+/);
      const orderCol = parts[0];
      const isDesc = parts[1] && parts[1].toUpperCase() === 'DESC';
      resultRows.sort((a, b) => {
        const valA = a[orderCol] ?? '';
        const valB = b[orderCol] ?? '';
        if (typeof valA === 'number' && typeof valB === 'number') {
          return isDesc ? valB - valA : valA - valB;
        }
        return isDesc ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB));
      });
    }

    // LIMIT
    if (rawLimit) {
      const lim = parseInt(rawLimit, 10);
      if (!isNaN(lim)) {
        resultRows = resultRows.slice(0, lim);
      }
    }

    // Fields projection
    const fieldsStr = rawFields.trim();
    let columns: string[] = [];
    let rows: any[][] = [];

    if (fieldsStr === '*') {
      columns = table.columns.map((c) => c.name);
      rows = resultRows.map((row) => columns.map((c) => row[c] ?? null));
    } else if (fieldsStr.toUpperCase().includes('COUNT(*)')) {
      columns = ['count(*)'];
      rows = [[resultRows.length]];
    } else {
      columns = fieldsStr.split(',').map((f) => f.trim().split(/\s+as\s+/i)[0].trim());
      rows = resultRows.map((row) => columns.map((col) => row[col] ?? null));
    }

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      query,
    };
  }

  private evalWhere(row: Record<string, any>, whereClause: string): boolean {
    const clause = whereClause.trim();
    if (clause.toUpperCase().includes(' AND ')) {
      const sub = clause.split(/\s+AND\s+/i);
      return sub.every((s) => this.evalCondition(row, s));
    }
    if (clause.toUpperCase().includes(' OR ')) {
      const sub = clause.split(/\s+OR\s+/i);
      return sub.some((s) => this.evalCondition(row, s));
    }
    return this.evalCondition(row, clause);
  }

  private evalCondition(row: Record<string, any>, cond: string): boolean {
    const c = cond.trim();
    // equals: col = 'val' or col = 1
    const eqMatch = c.match(/^([a-zA-Z0-9_]+)\s*(=|!=|>|<|LIKE)\s*(.+)$/i);
    if (!eqMatch) return true;

    const [, col, op, rawVal] = eqMatch;
    let targetVal: any = rawVal.trim().replace(/^['"]|['"]$/g, '');
    const rowVal = row[col];

    if (!isNaN(Number(targetVal))) {
      targetVal = Number(targetVal);
    }

    if (op === '=') {
      return String(rowVal) === String(targetVal);
    }
    if (op === '!=') {
      return String(rowVal) !== String(targetVal);
    }
    if (op === '>') {
      return Number(rowVal) > Number(targetVal);
    }
    if (op === '<') {
      return Number(rowVal) < Number(targetVal);
    }
    if (op.toUpperCase() === 'LIKE') {
      const pattern = String(targetVal).replace(/%/g, '.*');
      return new RegExp(pattern, 'i').test(String(rowVal || ''));
    }

    return true;
  }

  private executeInsert(query: string, startTime: number): SqlQueryResult {
    const match = query.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*(?:\(([\s\S]+?)\))?\s*VALUES\s*\(([\s\S]+?)\);?$/i);
    if (!match) throw new Error("Синтаксис INSERT: INSERT INTO table (col1, col2) VALUES ('val1', 2);");

    const [, rawTable, rawCols, rawVals] = match;
    const tableName = rawTable.trim().toLowerCase();
    const table = this.tables.get(tableName);
    if (!table) throw new Error(`Таблица '${tableName}' не найдена`);

    const cols = rawCols ? rawCols.split(',').map((c) => c.trim()) : table.columns.map((c) => c.name);
    const vals = rawVals.split(',').map((v) => {
      const clean = v.trim().replace(/^['"]|['"]$/g, '');
      return !isNaN(Number(clean)) ? Number(clean) : clean;
    });

    const newRow: Record<string, any> = {};
    cols.forEach((col, idx) => {
      newRow[col] = vals[idx] ?? null;
    });

    table.rows.push(newRow);

    return {
      columns: ['status', 'inserted_rows'],
      rows: [['SUCCESS', 1]],
      rowCount: 1,
      executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      query,
    };
  }

  private executeUpdate(query: string, startTime: number): SqlQueryResult {
    const match = query.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+?))?;?$/i);
    if (!match) throw new Error("Синтаксис UPDATE: UPDATE table SET col = 'val' WHERE id = '1';");

    const [, rawTable, rawSets, rawWhere] = match;
    const tableName = rawTable.trim().toLowerCase();
    const table = this.tables.get(tableName);
    if (!table) throw new Error(`Таблица '${tableName}' не найдена`);

    const setPairs = rawSets.split(',').map((s) => {
      const [k, v] = s.split('=').map((x) => x.trim());
      const cleanVal = v.replace(/^['"]|['"]$/g, '');
      return { k, v: !isNaN(Number(cleanVal)) ? Number(cleanVal) : cleanVal };
    });

    let affected = 0;
    for (const row of table.rows) {
      if (!rawWhere || this.evalWhere(row, rawWhere)) {
        for (const pair of setPairs) {
          row[pair.k] = pair.v;
        }
        affected++;
      }
    }

    return {
      columns: ['status', 'updated_rows'],
      rows: [['SUCCESS', affected]],
      rowCount: affected,
      executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      query,
    };
  }

  private executeDelete(query: string, startTime: number): SqlQueryResult {
    const match = query.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+?))?;?$/i);
    if (!match) throw new Error("Синтаксис DELETE: DELETE FROM table WHERE id = '1';");

    const [, rawTable, rawWhere] = match;
    const tableName = rawTable.trim().toLowerCase();
    const table = this.tables.get(tableName);
    if (!table) throw new Error(`Таблица '${tableName}' не найдена`);

    const initialLen = table.rows.length;
    if (rawWhere) {
      table.rows = table.rows.filter((row) => !this.evalWhere(row, rawWhere));
    } else {
      table.rows = [];
    }
    const affected = initialLen - table.rows.length;

    return {
      columns: ['status', 'deleted_rows'],
      rows: [['SUCCESS', affected]],
      rowCount: affected,
      executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      query,
    };
  }

  public exportSqlDump(): string {
    const lines: string[] = [
      '--',
      '-- RadarTG Local Relational SQLite Database Dump',
      `-- Exported: ${new Date().toISOString()}`,
      '-- Host/PC: Local SQLite Engine',
      '--',
      'PRAGMA foreign_keys = OFF;',
      'BEGIN TRANSACTION;',
      '',
    ];

    for (const table of this.tables.values()) {
      lines.push(`-- Table structure for: ${table.name}`);
      lines.push(`DROP TABLE IF EXISTS ${table.name};`);
      const colDefs = table.columns.map((c) => `${c.name} ${c.type}${c.isPrimary ? ' PRIMARY KEY' : ''}`).join(',\n  ');
      lines.push(`CREATE TABLE ${table.name} (\n  ${colDefs}\n);`);

      if (table.rows.length > 0) {
        lines.push(`-- Data for: ${table.name}`);
        const colNames = table.columns.map((c) => c.name).join(', ');
        for (const row of table.rows) {
          const valStrs = table.columns.map((c) => {
            const val = row[c.name];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            return `'${String(val).replace(/'/g, "''").replace(/\r?\n/g, '\\n')}'`;
          });
          lines.push(`INSERT INTO ${table.name} (${colNames}) VALUES (${valStrs.join(', ')});`);
        }
      }
      lines.push('');
    }

    lines.push('COMMIT;');
    return lines.join('\n');
  }

  public getRawRows(tableName: string): any[] {
    return this.tables.get(tableName)?.rows || [];
  }
}

export const localSqlEngine = new LocalSqlEngine();
