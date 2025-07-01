import dotenv from 'dotenv';
import path from 'path';
// apps/backend 폴더에 .env 파일이 있다고 가정
dotenv.config({ path: path.resolve(__dirname, '../.env') });


import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
// import path from 'path'; // 이미 위에서 import 함
import { Pool } from 'pg';

// kanji_data.json의 구조에 기반한 인터페이스
interface KanjiEntry {
  id?: number; // id가 없을 수도 있음을 가정
  kanji: string;
  meanings: string[]; // 배열로 가정
  kunyomi: string[];
  onyomi: string[];
  stroke_count: number; // 필드명 가정
  jlpt_level?: string; // 필드명 및 옵셔널 가정
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
  const filePath = path.join(__dirname, '../../../kanji_data.json'); // kanji-app/kanji_data.json
  const rawData = fs.readFileSync(filePath, 'utf-8');
  kanjiData = JSON.parse(rawData);
  console.log('Kanji data loaded successfully from JSON.');
} catch (error) {
  console.error('Error loading kanji_data.json:', error);
  // kanji_data.json이 없어도 서버는 시작될 수 있도록 오류를 throw하지 않음
}

async function initializeDatabase() {
  try {
    // 테이블 컬럼명은 KanjiEntry 인터페이스와 유사하게, 그리고 SQL에 맞게 조정
    // meanings는 TEXT 타입으로 저장하고, 애플리케이션 레벨에서 join/split 처리 또는 TEXT[] 사용
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kanji_characters (
        id SERIAL PRIMARY KEY,
        kanji VARCHAR(10) NOT NULL UNIQUE,
        meanings TEXT,
        kunyomi TEXT[],
        onyomi TEXT[],
        stroke_count INTEGER,
        jlpt_level VARCHAR(10)
      );
    `);
    console.log('Table "kanji_characters" checked/created successfully.');

    const { rows } = await pool.query('SELECT COUNT(*) as count FROM kanji_characters');
    const kanjiCount = parseInt(rows[0].count, 10);

    if (kanjiData.length > 0 && kanjiCount < kanjiData.length) { // JSON에 데이터가 있고, DB에 일부만 있거나 없을 때 시딩
      console.log('Seeding or updating database with kanji data...');
      for (const item of kanjiData) {
        // 필드 존재 여부 확인 및 기본값 제공
        const meaningsStr = item.meanings && Array.isArray(item.meanings) ? item.meanings.join(', ') : '';
        const kunyomiArr = item.kunyomi && Array.isArray(item.kunyomi) ? item.kunyomi : [];
        const onyomiArr = item.onyomi && Array.isArray(item.onyomi) ? item.onyomi : [];
        const strokeCount = typeof item.stroke_count === 'number' ? item.stroke_count : null;
        const jlptLevel = item.jlpt_level || null;

        await pool.query(
          `INSERT INTO kanji_characters (kanji, meanings, kunyomi, onyomi, stroke_count, jlpt_level)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (kanji) DO UPDATE SET
             meanings = EXCLUDED.meanings,
             kunyomi = EXCLUDED.kunyomi,
             onyomi = EXCLUDED.onyomi,
             stroke_count = EXCLUDED.stroke_count,
             jlpt_level = EXCLUDED.jlpt_level;`,
          [
            item.kanji,
            meaningsStr,
            kunyomiArr,
            onyomiArr,
            strokeCount,
            jlptLevel,
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
    const result = await pool.query('SELECT id, kanji, meanings, kunyomi, onyomi, stroke_count, jlpt_level FROM kanji_characters ORDER BY id ASC');
    const formattedRows = result.rows.map(row => ({
      ...row,
      meanings: row.meanings ? row.meanings.split(', ').filter(m => m) : [], // 빈 문자열 제거
      // kunyomi, onyomi는 이미 배열 타입이므로 변환 불필요
    }));
    res.json(formattedRows);
  } catch (error) {
    console.error('Error fetching all kanji:', error);
    res.status(500).json({ error: 'Failed to fetch kanji list' });
  }
});

// GET /api/kanji/:character - 특정 한자 정보 반환
app.get('/api/kanji/:character', async (req: Request, res: Response) => {
  const { character } = req.params;
  try {
    const result = await pool.query('SELECT id, kanji, meanings, kunyomi, onyomi, stroke_count, jlpt_level FROM kanji_characters WHERE kanji = $1', [character]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kanji not found' });
    }
    const row = result.rows[0];
    const formattedRow = {
      ...row,
      meanings: row.meanings ? row.meanings.split(', ').filter(m => m) : [], // 빈 문자열 제거
    };
    res.json(formattedRow);
  } catch (error) {
    console.error(`Error fetching kanji ${character}:`, error);
    res.status(500).json({ error: `Failed to fetch kanji ${character}` });
  }
});


pool.connect((err, client, release) => {
  if (err) {
    // 데이터베이스 연결 실패는 심각한 문제일 수 있으므로, 로깅 후 필요에 따라 프로세스 종료 고려
    console.error('FATAL: Error acquiring client for initial connection test', err.stack);
    // process.exit(1); // 또는 다른 오류 처리 메커니즘
    return;
  }
  client?.query('SELECT NOW()', (err, result) => {
    release(); // 항상 client를 release 해야 합니다.
    if (err) {
      console.error('Error executing initial query test', err.stack);
      return;
    }
    console.log('Successfully connected to PostgreSQL. Server time:', result?.rows[0].now);
  });
});

app.listen(port, async () => {
  console.log(`Backend server is running on http://localhost:${port}`);
  // 데이터베이스 연결이 준비된 후에 초기화 시도
  try {
    await pool.query('SELECT 1'); // 간단한 쿼리로 연결 상태 확인
    console.log('Database connection verified. Initializing database...');
    await initializeDatabase();
  } catch (err) {
    console.error('Failed to connect to database or initialize:', err);
    // DB 연결 실패 시 서버 시작은 계속되지만, 기능은 제한될 수 있음을 명시
  }
});
