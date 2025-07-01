import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import { Pool } from 'pg';

// 변경된 kanji_data.json 구조에 기반한 인터페이스
interface KanjiEntry {
  id?: number; // 자동 생성되므로 JSON 파일에는 없을 수 있음
  kanji: string; // 이 필드는 유지된다고 가정
  korean_meaning: string;
  onyomi: string[];
  kunyomi: string[];
  strokes: number;
  words?: object[]; // JSONB로 저장될 필드
  example_sentences?: object[]; // JSONB로 저장될 필드
  // jlpt_level 필드는 새 기준에 없으므로 제거 또는 주석 처리 (여기서는 제거)
}

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

let kanjiData: KanjiEntry[] = [];
try {
  const filePath = path.join(__dirname, '../../../kanji_data.json');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  kanjiData = JSON.parse(rawData);
  console.log('Kanji data loaded successfully from JSON.');
} catch (error) {
  console.error('Error loading kanji_data.json:', error);
}

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kanji_characters (
        id SERIAL PRIMARY KEY,
        kanji VARCHAR(10) NOT NULL UNIQUE,
        korean_meaning TEXT,
        onyomi TEXT[],
        kunyomi TEXT[],
        strokes INTEGER,
        words JSONB,
        example_sentences JSONB
      );
    `);
    console.log('Table "kanji_characters" checked/created successfully.');

    const { rows } = await pool.query('SELECT COUNT(*) as count FROM kanji_characters');
    const dbKanjiCount = parseInt(rows[0].count, 10);

    if (kanjiData.length > 0 && dbKanjiCount < kanjiData.length) { // JSON에 데이터가 있고, DB에 일부만 있거나 없을 때 시딩/업데이트
      console.log('Seeding or updating database with kanji data...');
      for (const item of kanjiData) {
        // 필드 존재 여부 확인 및 기본값 제공
        const koreanMeaning = item.korean_meaning || '';
        const onyomiArr = item.onyomi && Array.isArray(item.onyomi) ? item.onyomi : [];
        const kunyomiArr = item.kunyomi && Array.isArray(item.kunyomi) ? item.kunyomi : [];
        const strokesNum = typeof item.strokes === 'number' ? item.strokes : null;
        // words와 example_sentences는 JSON 객체/배열이므로 그대로 전달 (pg 드라이버가 JSONB로 변환)
        // 만약 undefined일 경우 null로 저장
        const wordsData = item.words || null;
        const exampleSentencesData = item.example_sentences || null;

        await pool.query(
          `INSERT INTO kanji_characters (kanji, korean_meaning, onyomi, kunyomi, strokes, words, example_sentences)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (kanji) DO UPDATE SET
             korean_meaning = EXCLUDED.korean_meaning,
             onyomi = EXCLUDED.onyomi,
             kunyomi = EXCLUDED.kunyomi,
             strokes = EXCLUDED.strokes,
             words = EXCLUDED.words,
             example_sentences = EXCLUDED.example_sentences;`,
          [
            item.kanji, // kanji 필드는 JSON 파일에 존재해야 함
            koreanMeaning,
            onyomiArr,
            kunyomiArr,
            strokesNum,
            wordsData,
            exampleSentencesData,
          ]
        );
      }
      console.log('Database seeding/updating completed.');
    } else if (kanjiData.length === 0) {
      console.log('No kanji data loaded from JSON, skipping seeding.');
    } else {
      console.log('Kanji data in DB is already up-to-date or no new data to seed.');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Kanji App Backend!');
});

// GET /api/kanji - 모든 한자 목록 반환
app.get('/api/kanji', async (req: Request, res: Response) => {
  try {
    // words, example_sentences는 JSONB 타입이므로 그대로 반환됨
    const result = await pool.query('SELECT id, kanji, korean_meaning, onyomi, kunyomi, strokes, words, example_sentences FROM kanji_characters ORDER BY id ASC');
    // 이전에는 meanings를 split 했으나, korean_meaning은 문자열이므로 추가 변환 불필요.
    // onyomi, kunyomi는 DB에서 TEXT[]로 잘 가져옴.
    // words, example_sentences는 JSONB 객체/배열로 잘 가져옴.
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all kanji:', error);
    res.status(500).json({ error: 'Failed to fetch kanji list' });
  }
});

// GET /api/kanji/:character - 특정 한자 정보 반환
app.get('/api/kanji/:character', async (req: Request, res: Response) => {
  const { character } = req.params;
  try {
    const result = await pool.query('SELECT id, kanji, korean_meaning, onyomi, kunyomi, strokes, words, example_sentences FROM kanji_characters WHERE kanji = $1', [character]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kanji not found' });
    }
    // 추가 변환 불필요. DB에서 가져온 row를 그대로 사용.
    res.json(result.rows[0]);
  } catch (error)
    console.error(`Error fetching kanji ${character}:`, error);
    res.status(500).json({ error: `Failed to fetch kanji ${character}` });
  }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('FATAL: Error acquiring client for initial connection test', err.stack);
    return;
  }
  client?.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      console.error('Error executing initial query test', err.stack);
      return;
    }
    console.log('Successfully connected to PostgreSQL. Server time:', result?.rows[0].now);
  });
});

app.listen(port, async () => {
  console.log(`Backend server is running on http://localhost:${port}`);
  try {
    await pool.query('SELECT 1');
    console.log('Database connection verified. Initializing database...');
    await initializeDatabase();
  } catch (err) {
    console.error('Failed to connect to database or initialize:', err);
  }
});
