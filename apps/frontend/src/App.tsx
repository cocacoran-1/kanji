import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// 백엔드의 KanjiEntry와 유사한 인터페이스 (또는 공유 타입으로 분리 가능)
interface Kanji {
  id: number;
  kanji: string;
  meanings: string[];
  kunyomi: string[];
  onyomi: string[];
  stroke_count: number; // 백엔드 API 응답 필드명과 일치
  jlpt_level?: string;
}

function App() {
  const [kanjiList, setKanjiList] = useState<Kanji[]>([]);
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // 초기 로딩 상태 true
  const [detailLoading, setDetailLoading] = useState<boolean>(false); // 상세 정보 로딩 상태

  useEffect(() => {
    const fetchKanjiList = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get('http://localhost:3001/api/kanji');
        setKanjiList(response.data);
      } catch (err) {
        console.error("Error fetching kanji list:", err);
        setError('Failed to load Kanji list. Is the backend running and data seeded?');
      } finally {
        setLoading(false);
      }
    };

    fetchKanjiList();
  }, []);

  const handleKanjiClick = async (kanjiChar: string) => {
    if (selectedKanji && selectedKanji.kanji === kanjiChar && !detailLoading) {
      setSelectedKanji(null); // 토글: 다시 누르면 상세 정보 닫기
      return;
    }

    setDetailLoading(true);
    setError(null); // 이전 상세 조회 오류 초기화
    try {
      const response = await axios.get(`http://localhost:3001/api/kanji/${encodeURIComponent(kanjiChar)}`);
      setSelectedKanji(response.data);
    } catch (err) {
      console.error(`Error fetching details for kanji ${kanjiChar}:`, err);
      setError(`Failed to load details for ${kanjiChar}.`);
      setSelectedKanji(null);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return <div className="App-container"><h1>Kanji Learning App</h1><p className="status-message">Loading Kanji data...</p></div>;
  }

  // 초기 로드 실패 시 전체 에러 메시지
  if (error && kanjiList.length === 0) {
     return <div className="App-container"><h1>Kanji Learning App</h1><p className="error-message">{error}</p></div>;
  }

  return (
    <div className="App-container">
      <header className="App-header">
        <h1>Kanji Learning App</h1>
      </header>

      {/* 상세 조회 에러 메시지 (목록 로딩 성공 후) */}
      {error && kanjiList.length > 0 && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}

      <div className="content-layout">
        <aside className="sidebar">
          <h2>Kanji List</h2>
          {kanjiList.length > 0 ? (
            <ul>
              {kanjiList.map((item) => (
                <li
                  key={item.id}
                  onClick={() => !detailLoading && handleKanjiClick(item.kanji)} // 상세 로딩 중 클릭 방지
                  className={`${selectedKanji?.id === item.id ? 'selected' : ''} ${detailLoading ? 'disabled' : ''}`}
                >
                  {item.kanji}
                </li>
              ))}
            </ul>
          ) : (
            <p className="status-message">No Kanji available.</p>
          )}
        </aside>

        <main className="main-content">
          {detailLoading && <p className="status-message">Loading details...</p>}
          {!detailLoading && selectedKanji ? (
            <div className="kanji-details">
              <h2>{selectedKanji.kanji}</h2>
              <p><strong>Meanings:</strong> {selectedKanji.meanings.join(', ')}</p>
              <p><strong>Kunyomi:</strong> {selectedKanji.kunyomi.join(', ')}</p>
              <p><strong>Onyomi:</strong> {selectedKanji.onyomi.join(', ')}</p>
              <p><strong>Strokes:</strong> {selectedKanji.stroke_count}</p>
              {selectedKanji.jlpt_level && <p><strong>JLPT Level:</strong> {selectedKanji.jlpt_level}</p>}
            </div>
          ) : (
            !detailLoading && <p className="placeholder-text">Select a Kanji from the list to see details.</p>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
