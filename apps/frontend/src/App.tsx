import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// 변경된 백엔드 API 응답 구조에 맞춘 인터페이스
interface Kanji {
  id: number;
  kanji: string; // 이 필드는 유지된다고 가정
  korean_meaning: string;
  onyomi: string[];
  kunyomi: string[];
  strokes: number;
  words?: object[]; // JSONB로 오므로 object[] 또는 any[]
  example_sentences?: object[]; // JSONB로 오므로 object[] 또는 any[]
}

function App() {
  const [kanjiList, setKanjiList] = useState<Kanji[]>([]);
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

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
      setSelectedKanji(null);
      return;
    }

    setDetailLoading(true);
    setError(null);
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

  if (error && kanjiList.length === 0) {
     return <div className="App-container"><h1>Kanji Learning App</h1><p className="error-message">{error}</p></div>;
  }

  return (
    <div className="App-container">
      <header className="App-header">
        <h1>Kanji Learning App</h1>
      </header>

      {error && kanjiList.length > 0 && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}

      <div className="content-layout">
        <aside className="sidebar">
          <h2>Kanji List</h2>
          {kanjiList.length > 0 ? (
            <ul>
              {kanjiList.map((item) => (
                <li
                  key={item.id}
                  onClick={() => !detailLoading && handleKanjiClick(item.kanji)}
                  className={`${selectedKanji?.id === item.id ? 'selected' : ''} ${detailLoading ? 'disabled' : ''}`}
                >
                  {item.kanji} {/* 한자 자체를 표시하는 것은 유지 */}
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
              <p><strong>Korean Meaning:</strong> {selectedKanji.korean_meaning}</p>
              <p><strong>Onyomi:</strong> {selectedKanji.onyomi.join(', ')}</p>
              <p><strong>Kunyomi:</strong> {selectedKanji.kunyomi.join(', ')}</p>
              <p><strong>Strokes:</strong> {selectedKanji.strokes}</p>
              {selectedKanji.words && selectedKanji.words.length > 0 && (
                <div>
                  <strong>Words:</strong>
                  {/* MVP에서는 간단히 JSON 문자열로 표시하거나, 개수만 표시 */}
                  <pre>{JSON.stringify(selectedKanji.words, null, 2)}</pre>
                  {/* 또는 <p>Count: {selectedKanji.words.length}</p> */}
                </div>
              )}
              {selectedKanji.example_sentences && selectedKanji.example_sentences.length > 0 && (
                <div>
                  <strong>Example Sentences:</strong>
                  <pre>{JSON.stringify(selectedKanji.example_sentences, null, 2)}</pre>
                  {/* 또는 <p>Count: {selectedKanji.example_sentences.length}</p> */}
                </div>
              )}
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
