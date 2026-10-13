// FastRegexOptimizer & Text Sanity Engine: sub-millisecond compiled regexes & token trie
// Designed for ultra-low-latency message cleaning & threat classification (< 2ms)

export interface FastCleanResult {
  cleanedText: string;
  removedElements: Array<{
    type: 'url' | 'mention' | 'donation' | 'clickbait' | 'keyword' | 'cleaner';
    content: string;
  }>;
  isPureSpam: boolean;
  spamScore: number;
  processingTimeMs: number;
}

export interface FastThreatResult {
  threatType: 'MISSILE' | 'DRONE' | 'AVIATION' | 'BALLISTIC' | 'ARTILLERY' | 'AIR_RAID' | 'ALL_CLEAR' | 'INFO';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  regions: string[];
  vector: string;
  altitudeSpeed?: string;
  threatCause?: string;
  routeTrajectory?: string;
  colorThreatLevel: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  processingTimeMs: number;
}

// Pre-compiled ultra-fast single regular expressions
// 1. URLs & Telegram links
const RE_URL = /(?:https?:\/\/|www\.)[^\s<>"'()]+|t\.me\/(?:\+[a-zA-Z0-9_-]+|[a-zA-Z0-9_]{3,}(?:\/[0-9]+)?)/gi;

// 2. Mentions
const RE_MENTION = /@[a-zA-Z0-9_]{3,}/g;

// 3. 16-digit cards (with spacing / dashes)
const RE_CARD = /\b(?:\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}|\d{16})\b/g;

// 4. Monobank jar links & direct jar IDs
const RE_MONO_JAR = /(?:send\.monobank\.ua\/[a-zA-Z0-9_.]+|jar\/[a-zA-Z0-9_]+)/gi;

// 5. Crypto addresses: TRC-20 (T...), ETH/EVM (0x...), BTC (1/3/bc1)
const RE_CRYPTO = /\b(?:0x[a-fA-F0-9]{40}|T[A-Za-z1-9]{33}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})\b/g;

// 6. Donation, card requests and bank mentions
const RE_DONATION = /(?:сбор\s+на|збір\s+на|банка\s+моно|монобанк|помощь\s+пво|поддержите\s+канал|реквизиты[:\s]|карта\s+приват|карта\s+моно|карта[:\s]|на\s+кофе|скиньте\s+на|донат|донаты|donat|на\s+тепловизор|на\s+мавики|на\s+дроны|номер\s+карты|реквизиты\s+в\s+закрепе)[^.\n!?;]*(?:кошелек|гривен|грн|руб|usd|eur|usdt|моно|приват|paypal)?/gi;

// 7. Clickbait, promotional telegram teasers & spam phrases
const RE_CLICKBAIT = /(?:шок[! ]*видео|срочное\s+заявление|эксклюзивные\s+кадры|слили\s+координаты|точный\s+график\s+ударов|успей\s+посмотреть|пока\s+не\s+удалили|жми\s+сюда|подпишись\s+на\s+резерв|наш\s+резервный\s+канал|переходи\s+по\s+ссылке|читать\s+далее|все\s+подробности\s+в\s+канале|ссылка\s+в\s+комментариях|только\s+для\s+подписчиков|реклама[:\s]|партнерский\s+материал|erid[:\s]|спонсор\s+сводки|промокод|скидка\s+\d+%\s+на|забирай\s+бонус)[^\n]*/gi;

// 8. Spam emojis and excessive punctuation
const RE_EXCESSIVE_EMOJIS = /([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])[ \t]*\1{2,}/gu;
const RE_EXCESSIVE_PUNCT = /[!]{3,}|[?]{3,}|[.]{4,}|[👇👉🔥💥💣⚡️]{2,}/g;

// 9. Threat markers
const RE_THREAT_KEYWORDS = /(?:ракета|баллистик|шахед|дрон|бпла|герань|мопед|авиаци|су-34|ту-95|миг-31|каб|тревог|тривог|отбой|відбій|взрыв|вибух|обстрел|пво|пуск|сирена|направлени|напрямок|укрыти|укриття|ракетн)/i;

// Pre-compiled keyword lists for lightning vector & threat type detection
interface ThreatRule {
  type: 'MISSILE' | 'DRONE' | 'AVIATION' | 'BALLISTIC' | 'ARTILLERY' | 'AIR_RAID' | 'ALL_CLEAR' | 'INFO';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  keywords: string[];
}

const THREAT_RULES: ThreatRule[] = [
  {
    type: 'BALLISTIC',
    severity: 'CRITICAL',
    keywords: ['баллистик', 'балістик', 'искандер-м', 'кинжал', 'кинджал', 'с-300', 'с-400', 'пуск баллист', 'загроза баліст'],
  },
  {
    type: 'MISSILE',
    severity: 'CRITICAL',
    keywords: ['ракета', 'ракетн', 'х-101', 'х-555', 'калибр', 'калібр', 'х-59', 'х-69', 'х-22', 'циркон', 'пуск ракет', 'крилата ракета'],
  },
  {
    type: 'DRONE',
    severity: 'HIGH',
    keywords: ['шахед', 'shahed', 'дрон', 'бпла', 'герань', 'мопед', 'гербера', 'ударные бпла', 'группа бпла', 'шахід'],
  },
  {
    type: 'AVIATION',
    severity: 'HIGH',
    keywords: ['су-34', 'ту-95', 'ту-22', 'миг-31', 'міг-31', 'каб', 'фаб', 'тактическая авиация', 'тактична авіація', 'управляемые авиабомбы'],
  },
  {
    type: 'ARTILLERY',
    severity: 'HIGH',
    keywords: ['артиллери', 'артилері', 'рсзо', 'град', 'ураган', 'смерч', 'обстрел', 'обстріл', 'артобстрел'],
  },
  {
    type: 'ALL_CLEAR',
    severity: 'LOW',
    keywords: ['отбой', 'відбій', 'чисто', 'угроза миновала', 'загроза минула', 'отбой тревоги', 'відбій тривоги'],
  },
  {
    type: 'AIR_RAID',
    severity: 'MEDIUM',
    keywords: ['тревога', 'тривога', 'сирена', 'воздушная тревога', 'повітряна тривога', 'укрытия', 'укриття'],
  },
];

// Pre-compiled region dictionary with variations & Ukrainian / Russian forms
const REGION_MAP: Array<{ region: string; aliases: string[] }> = [
  { region: 'Киев', aliases: ['киев', 'київ', 'васильков', 'васильків', 'белая церковь', 'біла церква', 'бровары', 'бровари', 'бориспіль', 'борисполь', 'обухов', 'обухів', 'вышгород', 'фастов'] },
  { region: 'Хмельницкий', aliases: ['хмельниц', 'хмельницьк', 'староконстантинов', 'старокостянтинів', 'шепетовка', 'шепетівка', 'деражня', 'летичев', 'летичів', 'полонное'] },
  { region: 'Харьков', aliases: ['харьков', 'харків', 'чугуев', 'чугуїв', 'купянск', 'куп\'янськ', 'изюм', 'ізюм', 'люботин', 'дергачи'] },
  { region: 'Одесса', aliases: ['одесс', 'одес', 'черноморск', 'чорноморськ', 'затока', 'маяки', 'южное', 'южне', 'измаил', 'ізмаїл'] },
  { region: 'Днепр', aliases: ['днепр', 'дніпр', 'кривой рог', 'кривий ріг', 'каменское', 'кам\'янське', 'никополь', 'нікополь', 'павлоград', 'новомосковск'] },
  { region: 'Запорожье', aliases: ['запорожь', 'запоріжж', 'вольнянск', 'вільнянськ', 'орехов', 'оріхів', 'гуляйполе'] },
  { region: 'Полтава', aliases: ['полтав', 'кременчуг', 'кременчук', 'миргород', 'лубны', 'лубни'] },
  { region: 'Сумы', aliases: ['сум', 'конотоп', 'шостка', 'ахтырка', 'охтирка', 'ромены'] },
  { region: 'Чернигов', aliases: ['чернигов', 'чернігів', 'нежин', 'ніжин', 'прилуки'] },
  { region: 'Черкассы', aliases: ['черкасс', 'черкас', 'умань', 'смела', 'сміла', 'золотоноша'] },
  { region: 'Винница', aliases: ['винниц', 'вінниц', 'жмеринка', 'могилев-подольский', 'казатин', 'козятин', 'бар', 'ладыжин', 'ладижин'] },
  { region: 'Житомир', aliases: ['житомир', 'бердичев', 'бердичів', 'коростень', 'новоград', 'звягель'] },
  { region: 'Николаев', aliases: ['николаев', 'миколаїв', 'очаков', 'очаків', 'вознесенск', 'первомайск'] },
  { region: 'Херсон', aliases: ['херсон', 'берислав', 'чернобаевка', 'белозерка'] },
  { region: 'Львов', aliases: ['львов', 'львів', 'стрый', 'трий', 'дробыч', 'самбор', 'яворов'] },
  { region: 'Ивано-Франковск', aliases: ['франковск', 'франківськ', 'коломыя', 'коломия', 'калуш'] },
  { region: 'Тернополь', aliases: ['тернопол', 'тернопіль', 'кременец', 'чортков'] },
  { region: 'Ровно', aliases: ['ровно', 'рівне', 'дубно', 'сарна', 'вари'] },
  { region: 'Волынь', aliases: ['луцк', 'луцьк', 'ковыль', 'нововолынск', 'волынь', 'волинь'] },
  { region: 'Закарпатье', aliases: ['ужгород', 'мукачево', 'берегово', 'хуст', 'закарпат'] },
  { region: 'Черновцы', aliases: ['черновц', 'чернівц', 'новоселица'] },
  { region: 'Кропивницкий', aliases: ['кропивниц', 'кропивницьк', 'александрия', 'олександрія', 'знаменка'] },
];

export class FastTextEngine {
  private customKeywordsLower: string[] = [];
  private compiledUserRegexes: RegExp[] = [];

  constructor(customKeywords: string[] = [], customRegexes: string[] = []) {
    this.updateUserRules(customKeywords, customRegexes);
  }

  public updateUserRules(customKeywords: string[] = [], customRegexes: string[] = []) {
    this.customKeywordsLower = customKeywords
      .filter((k) => k && k.trim().length > 0)
      .map((k) => k.trim().toLowerCase());

    this.compiledUserRegexes = [];
    for (const r of customRegexes) {
      if (!r || !r.trim()) continue;
      try {
        this.compiledUserRegexes.push(new RegExp(r.trim(), 'gi'));
      } catch {
        // gracefully skip invalid regex
      }
    }
  }

  /**
   * Ultra-fast sub-millisecond heuristic text cleaner & spam stripper
   */
  public cleanFast(
    rawText: string,
    options: {
      removeUrls?: boolean;
      removeMentions?: boolean;
      removeDonations?: boolean;
      removeClickbait?: boolean;
      removeExcessiveEmojis?: boolean;
    } = {}
  ): FastCleanResult {
    const t0 = performance.now();
    let text = rawText;
    const removedElements: FastCleanResult['removedElements'] = [];

    const removeUrls = options.removeUrls ?? true;
    const removeMentions = options.removeMentions ?? true;
    const removeDonations = options.removeDonations ?? true;
    const removeClickbait = options.removeClickbait ?? true;
    const removeEmojis = options.removeExcessiveEmojis ?? true;

    // 1. URLs
    if (removeUrls) {
      const urls = text.match(RE_URL);
      if (urls) {
        for (const u of urls) {
          removedElements.push({ type: 'url', content: u });
        }
        text = text.replace(RE_URL, ' ');
      }
    }

    // 2. Mentions
    if (removeMentions) {
      const mentions = text.match(RE_MENTION);
      if (mentions) {
        for (const m of mentions) {
          removedElements.push({ type: 'mention', content: m });
        }
        text = text.replace(RE_MENTION, ' ');
      }
    }

    // 3. Bank Cards
    if (removeDonations) {
      const cards = text.match(RE_CARD);
      if (cards) {
        for (const c of cards) {
          const rawNum = c.replace(/\D/g, '');
          if (rawNum.length >= 13 && rawNum.length <= 19) {
            removedElements.push({ type: 'donation', content: `Карта: ${c.trim()}` });
          }
        }
        text = text.replace(RE_CARD, ' ');
      }

      // Monobank jar
      const jars = text.match(RE_MONO_JAR);
      if (jars) {
        for (const j of jars) {
          removedElements.push({ type: 'donation', content: `Монобанка: ${j.trim()}` });
        }
        text = text.replace(RE_MONO_JAR, ' ');
      }

      // Crypto addresses
      const cryptos = text.match(RE_CRYPTO);
      if (cryptos) {
        for (const cr of cryptos) {
          removedElements.push({ type: 'donation', content: `Криптокошелек: ${cr.trim()}` });
        }
        text = text.replace(RE_CRYPTO, ' ');
      }

      // Donation phrases
      const donPhrases = text.match(RE_DONATION);
      if (donPhrases) {
        for (const p of donPhrases) {
          if (p.trim().length > 3) {
            removedElements.push({ type: 'donation', content: p.trim() });
          }
        }
        text = text.replace(RE_DONATION, ' ');
      }
    }

    // 4. Clickbait & Ads
    if (removeClickbait) {
      const clickbaits = text.match(RE_CLICKBAIT);
      if (clickbaits) {
        for (const cb of clickbaits) {
          if (cb.trim().length > 3) {
            removedElements.push({ type: 'clickbait', content: cb.trim() });
          }
        }
        text = text.replace(RE_CLICKBAIT, ' ');
      }
    }

    // 5. Custom Stop-words (Fast string scan)
    if (this.customKeywordsLower.length > 0) {
      const lowerCandidate = text.toLowerCase();
      for (const kw of this.customKeywordsLower) {
        if (lowerCandidate.includes(kw)) {
          removedElements.push({ type: 'keyword', content: `Стоп-слово: "${kw}"` });
          const safeKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          text = text.replace(new RegExp(safeKw, 'gi'), ' ');
        }
      }
    }

    // 5b. User custom regexes
    for (const userRe of this.compiledUserRegexes) {
      const matches = text.match(userRe);
      if (matches) {
        for (const m of matches) {
          if (m && m.trim()) {
            removedElements.push({ type: 'keyword', content: `RegEx совпадение: "${m.trim()}"` });
          }
        }
        text = text.replace(userRe, ' ');
      }
    }

    // 6. Emojis and repeating punctuations
    if (removeEmojis) {
      text = text.replace(RE_EXCESSIVE_EMOJIS, '$1');
      text = text.replace(RE_EXCESSIVE_PUNCT, '');
    }

    // Trim lines
    const cleanedLines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const cleanedText = cleanedLines.join('\n');

    // Spam score & pure spam detection
    const origLen = rawText.trim().length || 1;
    const cleanLen = cleanedText.length;
    let spamScore = Math.min(100, Math.round(((origLen - cleanLen) / origLen) * 100));

    if (removedElements.some((e) => e.type === 'clickbait' || e.type === 'donation')) {
      spamScore = Math.max(spamScore, 45);
    }

    const hasThreat = RE_THREAT_KEYWORDS.test(cleanedText) || RE_THREAT_KEYWORDS.test(rawText);
    const isPureSpam = (!hasThreat && removedElements.length > 0) || cleanedText.length < 8;

    const t1 = performance.now();
    const processingTimeMs = Math.round((t1 - t0) * 100) / 100; // e.g. 0.45 ms

    return {
      cleanedText: isPureSpam ? '' : cleanedText,
      removedElements,
      isPureSpam,
      spamScore: isPureSpam ? 100 : spamScore,
      processingTimeMs,
    };
  }

  /**
   * Sub-millisecond deterministic threat & vector classifier (< 1ms)
   */
  public analyzeFastThreat(text: string): FastThreatResult {
    const t0 = performance.now();
    const lower = text.toLowerCase();

    let threatType: FastThreatResult['threatType'] = 'INFO';
    let severity: FastThreatResult['severity'] = 'LOW';

    // 1. Identify threat type by rule priority
    for (const rule of THREAT_RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        threatType = rule.type;
        severity = rule.severity;
        break;
      }
    }

    // 2. Identify regions from pre-compiled alias dictionary
    const detectedRegions: string[] = [];
    for (const item of REGION_MAP) {
      if (item.aliases.some((alias) => lower.includes(alias))) {
        detectedRegions.push(item.region);
      }
    }

    // 3. Extract movement vector or course if present
    let vector = 'Курс уточняется';
    const vectorMatches = text.match(/(?:курс(?:ом)?\s+на|в\s+направлении|напрямком\s+на|в\s+сторону|рух\s+у\s+напрямку)[^.,!\n]{3,35}/i);
    if (vectorMatches) {
      vector = vectorMatches[0].trim();
    } else {
      const arrowMatch = text.match(/[А-Яа-яA-Za-z0-9\s-]{3,15}\s*(?:->|➔|=>|→)\s*[А-Яа-яA-Za-z0-9\s-]{3,20}/);
      if (arrowMatch) {
        vector = arrowMatch[0].trim();
      } else if (detectedRegions.length >= 2) {
        vector = `${detectedRegions[0]} ➔ ${detectedRegions[1]}`;
      } else if (detectedRegions.length === 1) {
        vector = `Курс в сектор ${detectedRegions[0]}`;
      }
    }

    // 4. Extract speed or altitude if mentioned
    let altitudeSpeed: string | undefined;
    const speedMatch = text.match(/(?:скорость|швидкість|висота|высота|эшелон)\s*[:~]?\s*[0-9]+(?:\s*(?:км\/ч|м|км|м\/с))?/i);
    if (speedMatch) {
      altitudeSpeed = speedMatch[0].trim();
    }

    // 5. Threat color level
    const colorThreatLevel: FastThreatResult['colorThreatLevel'] =
      severity === 'CRITICAL' ? 'RED' : severity === 'HIGH' ? 'ORANGE' : severity === 'MEDIUM' ? 'YELLOW' : 'GREEN';

    const t1 = performance.now();
    const processingTimeMs = Math.round((t1 - t0) * 100) / 100;

    return {
      threatType,
      severity,
      regions: detectedRegions.length > 0 ? detectedRegions : ['Сектор уточняется'],
      vector,
      altitudeSpeed,
      colorThreatLevel,
      processingTimeMs,
    };
  }
}

// Global Singleton instance for reuse across server
export const fastEngine = new FastTextEngine();
