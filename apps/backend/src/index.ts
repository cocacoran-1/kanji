import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import { Pool } from 'pg';

// 변경된 kanji_data.json 구조에 맞춘 타입 정의
interface Kanji {
  kanji: string;
  level: string;
  korean_meaning: string;       // 뜻
  korean_pronunciation: string; // 음 (새로 추가)
  onyomi: string[];
  kunyomi: string[];
  strokes: number;
  radical: string;
  words: object[];
  example_sentences: object[];
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

// 데이터베이스 초기화 함수
async function initializeDatabase() {
  let kanjiData: Kanji[] = [];
  try {
    const filePath = path.join(__dirname, '../../../kanji_data.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    kanjiData = JSON.parse(rawData);
    console.log('Kanji data loaded successfully from JSON.');
  } catch (error) {
    console.error('Could not load kanji_data.json:', error);
    return;
  }

  try {
    // DB 테이블 생성: korean_pronunciation 컬럼 추가
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kanji (
        id SERIAL PRIMARY KEY,
        kanji VARCHAR(5) NOT NULL UNIQUE,
        level VARCHAR(10),
        korean_meaning VARCHAR(50),
        korean_pronunciation VARCHAR(50), -- 컬럼 추가
        onyomi TEXT[],
        kunyomi TEXT[],
        strokes INTEGER,
        radical VARCHAR(10),
        words JSONB,
        example_sentences JSONB
      );
    `);
    console.log('Table "kanji" checked/created successfully.');

    // 데이터베이스에 데이터 채우기 (Seeding)
    console.log('Seeding database with kanji data...');
    for (const item of kanjiData) {
      // INSERT 문 수정: korean_pronunciation 추가
      await pool.query(
        `INSERT INTO kanji (kanji, level, korean_meaning, korean_pronunciation, onyomi, kunyomi, strokes, radical, words, example_sentences)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (kanji) DO NOTHING;`, // 이미 있는 한자는 건너뛰기
        [
          item.kanji,
          item.level,
          item.korean_meaning,
          item.korean_pronunciation, // 파라미터 추가
          item.onyomi,
          item.kunyomi,
          item.strokes,
          item.radical,
          JSON.stringify(item.words),
          JSON.stringify(item.example_sentences),
        ]
      );
    }
    console.log('Database seeding completed.');
  } catch (error) {
    console.error('Error during database initialization:', error);
  }
}

// --- API 라우트 설정 ---

// GET /api/kanji - 모든 한자 목록 반환
app.get('/api/kanji', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM kanji ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all kanji:', error);
    res.status(500).json({ message: 'Failed to fetch kanji list' });
  }
});

// GET /api/kanji/:character - 특정 한자 정보 반환
app.get('/api/kanji/:character', async (req: Request, res: Response) => {
  const { character } = req.params;
  try {
    const result = await pool.query('SELECT * FROM kanji WHERE kanji = $1', [character]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Kanji not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching details for kanji ${character}:`, error);
    res.status(500).json({ message: 'Failed to fetch kanji details' });
  }
});

// --- 서버 시작 ---
app.listen(port, async () => {
  console.log(`Backend server is running on http://localhost:${port}`);
  // 서버 시작 시 DB 초기화 전, 기존 테이블을 삭제하여 변경사항을 확실히 반영
  try {
      await pool.query('DROP TABLE IF EXISTS kanji;');
      console.log('Existing "kanji" table dropped to apply new schema.');
  } catch (error) {
      console.error('Could not drop table:', error);
  }
  await initializeDatabase();
});
